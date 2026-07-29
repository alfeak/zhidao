import hashlib
import asyncio
import json
from datetime import datetime, timezone
from uuid import uuid4
import re
from pathlib import PurePosixPath
from ..domain.errors import NotFoundError, ValidationError
from ..domain.translation_languages import TRANSLATION_LANGUAGE_BY_CODE
from ..infrastructure.mineru_client import MinerUClient
from ..infrastructure.object_store import R2ObjectStore
from ..infrastructure.repositories import PaperRepository, ConfigRepository, CollaborationRepository
from ..infrastructure.openai_gateway import OpenAICompatibleGateway
from .paper_title_resolver import PaperTitleResolver

class PaperService:
    def __init__(self):
        self.papers, self.config, self.collaboration = PaperRepository(), ConfigRepository(), CollaborationRepository()
        self.mineru = MinerUClient(); self.title_resolver = PaperTitleResolver()
        self.llm = OpenAICompatibleGateway()
        self._translation_tasks: dict[str, asyncio.Task] = {}

    @staticmethod
    def now(): return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def identifier(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:12]}"

    @staticmethod
    def identifier_for_url(url: str) -> str:
        url_hash = hashlib.sha256(url.strip().encode("utf-8")).hexdigest()[:16]
        return f"paper_{url_hash}"

    def list_papers(self): return self.papers.list()

    def paper(self, id):
        paper = self.papers.get(id)
        if not paper: raise NotFoundError("Paper not found")
        return paper
    async def import_paper(self, url, title=None):
        if not url or not url.strip(): raise ValidationError("Paper URL is required")
        r = await self.title_resolver.resolve(url, title)
        paper_id = self.identifier_for_url(r.url)

        # 1. Check if paper already exists in DB and is decoded
        existing = self.papers.get(paper_id)
        if existing and existing.get("isDecoded"):
            return existing

        # 2. Check if R2 storage already contains cached artifacts for this paper URL
        try:
            cached_artifacts = R2ObjectStore().list_cached_artifacts(paper_id)
        except Exception:
            cached_artifacts = []

        has_markdown = any(a.archive_path.endswith(".md") and not a.archive_path.startswith("translations/") for a in cached_artifacts)

        # 3. If R2 cache hit, populate database and skip MinerU parsing
        if has_markdown:
            self.papers.create({"id": paper_id, "title": r.title, "url": r.url, "importedAt": self.now()})
            self.papers.save_artifacts(paper_id, cached_artifacts)
            return self.papers.get(paper_id)

        # 4. If R2 cache miss, create initial paper record for background MinerU decoding
        return self.papers.create({"id": paper_id, "title": r.title, "url": r.url, "importedAt": self.now()})

    def delete_paper(self, id):
        found, prefix = self.papers.delete(id)
        if not found: raise NotFoundError("Paper not found")
        # R2 objects are intentionally retained so re-importing the URL reuses cached parsing results.

    def start_decoding(self, id):
        if not self.papers.get(id): raise NotFoundError("Paper not found")
        self.papers.set_status(id, "pending"); return self.papers.get(id)

    async def decode(self, id):
        paper = self.papers.get(id)
        if not paper: return
        if paper.get("isDecoded"): return
        self.papers.set_status(id, "processing")
        try:
            # Check R2 cache first before invoking MinerU API
            try:
                cached_artifacts = R2ObjectStore().list_cached_artifacts(id)
            except Exception:
                cached_artifacts = []
            if any(a.archive_path.endswith(".md") and not a.archive_path.startswith("translations/") for a in cached_artifacts):
                self.papers.save_artifacts(id, cached_artifacts)
                return

            result = await self.mineru.parse_url(paper["url"])
            self.papers.save_artifacts(id, R2ObjectStore().put_archive(id, result.files))
        except Exception as e:
            self.papers.set_status(id, "failed", str(e))

    def artifact(self, id, path):
        a = self.papers.artifact(id, path)
        if not a: raise NotFoundError("Document object was not found.")
        return a

    def markdown_artifact(self, id):
        from ..infrastructure.database import SessionLocal
        from ..infrastructure.orm_models import DocumentArtifactRecord
        from sqlalchemy import select
        with SessionLocal() as s:
            a = s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id == id, DocumentArtifactRecord.kind == "markdown"))
        if not a: raise NotFoundError("Markdown was not found.")
        return a

    def markdown(self, id):
        artifact = self.markdown_artifact(id)
        return R2ObjectStore().read(artifact.object_key).decode("utf-8"), artifact

    def markdown_block_count(self, id: str) -> int:
        """Return the canonical block count used by both original and translated views."""
        content, _ = self.markdown(id)
        blocks = [part.strip() for part in re.split(r"(?=^#{1,6}\s)", content, flags=re.MULTILINE) if part.strip()]
        return len(blocks) or 1

    def layout_boxes(self, id: str) -> list[dict]:
        """Return MinerU layout boxes in their original page coordinate space."""
        from ..infrastructure.database import SessionLocal
        from ..infrastructure.orm_models import DocumentArtifactRecord
        from sqlalchemy import select

        with SessionLocal() as session:
            artifacts = list(session.scalars(select(DocumentArtifactRecord).where(
                DocumentArtifactRecord.document_id == id,
                DocumentArtifactRecord.kind == "json",
            )))
        artifact = next((item for item in artifacts if item.archive_path == "layout.json"), None)
        if not artifact:
            return []
        try:
            payload = json.loads(R2ObjectStore().read(artifact.object_key))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return []

        boxes: list[dict] = []
        for page in payload.get("pdf_info", []) if isinstance(payload, dict) else []:
            page_index, page_size = page.get("page_idx"), page.get("page_size")
            if not isinstance(page_index, int) or not isinstance(page_size, list) or len(page_size) != 2:
                continue
            page_width, page_height = page_size
            if not all(isinstance(value, (int, float)) and value > 0 for value in (page_width, page_height)):
                continue
            for index, block in enumerate(page.get("preproc_blocks", [])):
                bbox = block.get("bbox") if isinstance(block, dict) else None
                if not isinstance(bbox, list) or len(bbox) != 4 or not all(isinstance(value, (int, float)) for value in bbox):
                    continue
                x0, y0, x1, y1 = bbox
                x0, x1 = max(0, min(page_width, x0)), max(0, min(page_width, x1))
                y0, y1 = max(0, min(page_height, y0)), max(0, min(page_height, y1))
                if x1 <= x0 or y1 <= y0:
                    continue
                boxes.append({
                    "id": f"{page_index}:{block.get('index', index)}",
                    "pageIndex": page_index,
                    "pageWidth": page_width,
                    "pageHeight": page_height,
                    "x0": x0,
                    "y0": y0,
                    "x1": x1,
                    "y1": y1,
                    "type": str(block.get("type", "content")),
                })
        return boxes

    @staticmethod
    def translation_language(target_language: str) -> dict:
        if not isinstance(target_language, str): raise ValidationError("targetLanguage must be a string")
        language = TRANSLATION_LANGUAGE_BY_CODE.get(target_language.strip())
        if not language: raise ValidationError("targetLanguage must be one of the supported language codes")
        return language

    @classmethod
    def translation_path(cls, target_language: str, source_archive_path: str) -> str:
        language = cls.translation_language(target_language)
        source_name = PurePosixPath(source_archive_path).name
        stem = PurePosixPath(source_name).stem
        return f"translations/{stem}.{language['code']}.md"

    def translated_markdown(self, id: str, target_language: str):
        language = self.translation_language(target_language)
        from ..infrastructure.database import SessionLocal
        from ..infrastructure.orm_models import DocumentArtifactRecord
        from sqlalchemy import select
        with SessionLocal() as s:
            artifact = s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id == id, DocumentArtifactRecord.kind == "translation", DocumentArtifactRecord.translation_language == language["code"]))
        if not artifact or artifact.kind != "translation": raise NotFoundError("Translation was not found.")
        return R2ObjectStore().read(artifact.object_key).decode("utf-8"), artifact

    async def translate_markdown(self, id: str, target_language: str):
        paper = self.paper(id)
        language = self.translation_language(target_language)
        source, source_artifact = self.markdown(id)
        archive_path = self.translation_path(language["code"], source_artifact.archive_path)
        cfg = self.config.get(masked=False)
        instruction = "You translate academic Markdown. Return only translated Markdown. Translate prose only; preserve every Markdown construct, headings, lists, tables, links, URLs, image paths, HTML, code fences, inline code, LaTex/math, citations, and whitespace/layout. Do not add or remove sections."
        translated = await self.llm.generate(
            cfg,
            f"Target language: {language['name']} ({language['code']})\n\nMarkdown to translate:\n{source}",
            system_instruction=instruction,
        )
        if not translated.strip(): raise ValidationError("The translation model returned an empty document.")
        stored = R2ObjectStore().put(id, archive_path, translated.encode("utf-8"))
        self.papers.save_translation(id, stored, language["code"])
        return {"paperId": paper["id"], "targetLanguage": language["code"], "archivePath": archive_path, "content": translated}

    async def enqueue_translation(self, id: str, target_language: str):
        self.paper(id)
        self.markdown(id)  # Fail fast when parsing has not completed.
        language = self.translation_language(target_language)
        job, _ = self.papers.enqueue_translation(id, language["code"], self.now())
        # Scheduling is idempotent. Re-attempt it for an existing pending job so
        # a request can recover from an unexpected in-process task loss.
        self.schedule_translation(id)
        return job

    def schedule_translation(self, id: str):
        current = self._translation_tasks.get(id)
        if current and not current.done(): return
        task = asyncio.create_task(self.run_translation_job(id), name=f"translation:{id}")
        self._translation_tasks[id] = task
        task.add_done_callback(lambda _: self._translation_tasks.pop(id, None))

    async def run_translation_job(self, id: str):
        job = self.papers.claim_translation(id, self.now())
        if not job: return
        try:
            await self.translate_markdown(id, job["targetLanguage"])
        except Exception as error:
            self.papers.finish_translation(id, "failed", str(error), self.now())
        else:
            self.papers.finish_translation(id, "done", None, self.now())

    async def recover_translation_jobs(self):
        for id in self.papers.resume_translation_jobs(self.now()):
            self.schedule_translation(id)
    async def chat(self, id: str, message: str):
        paper = self.papers.get(id)
        if not paper: raise NotFoundError("Paper not found")
        cfg = self.config.get(masked=False)
        user_msg = {"id": f"msg_{uuid4().hex[:8]}", "paperId": id, "role": "user", "content": message, "createdAt": self.now()}
        self.collaboration.add_message(user_msg)
        try:
            markdown_content, _ = self.markdown(id)
        except Exception:
            markdown_content = ""
        system_prompt = (
            f"You are an expert AI research assistant analyzing the paper titled '{paper['title']}'.\n"
            f"Paper URL: {paper['url']}\n"
            f"Parsed Content:\n{markdown_content[:6000]}\n"
        )
        reply = await self.llm.generate(cfg, message, system_instruction=system_prompt)
        assistant_msg = {"id": f"msg_{uuid4().hex[:8]}", "paperId": id, "role": "assistant", "content": reply, "createdAt": self.now()}
        self.collaboration.add_message(assistant_msg)
        return assistant_msg

    async def action(self, id: str, payload: dict):
        paper = self.papers.get(id)
        if not paper: raise NotFoundError("Paper not found")
        action_type = payload.get("action")
        target_lang = payload.get("targetLanguage", "Chinese (简体中文)")
        cfg = self.config.get(masked=False)
        try:
            markdown_content, _ = self.markdown(id)
        except Exception:
            markdown_content = paper.get("title", "")
        if action_type in ("translate_full", "translate"):
            prompt = (
                f"Please translate the following academic paper into {target_lang}.\n"
                f"Maintain precise academic terminology, structure, and formatting.\n\n"
                f"Paper Title: {paper['title']}\n\n"
                f"Paper Content:\n{markdown_content[:10000]}"
            )
            result = await self.llm.generate(cfg, prompt, system_instruction=f"You are a professional academic translator specializing in translating papers into {target_lang}.")
            return {"success": True, "result": result}
        else:
            prompt = f"Perform analysis '{action_type}' for target language '{target_lang}' on this paper content:\n{markdown_content[:8000]}"
            result = await self.llm.generate(cfg, prompt)
            return {"success": True, "result": result}




