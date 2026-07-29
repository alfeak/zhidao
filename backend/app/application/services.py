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
from ..infrastructure.search_index import SearchIndex
from .paper_title_resolver import PaperTitleResolver

class PaperService:
    def __init__(self):
        self.papers, self.config, self.collaboration = PaperRepository(), ConfigRepository(), CollaborationRepository()
        self.mineru = MinerUClient(); self.title_resolver = PaperTitleResolver()
        self.llm = OpenAICompatibleGateway(); self.search_index = SearchIndex()
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
            self.reindex_paper(paper_id)
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
            self.reindex_paper(paper_id)
            return self.papers.get(paper_id)

        # 4. If R2 cache miss, create initial paper record for background MinerU decoding
        created = self.papers.create({"id": paper_id, "title": r.title, "url": r.url, "importedAt": self.now()})
        self.reindex_paper(paper_id)
        return created

    def delete_paper(self, id):
        found, prefix = self.papers.delete(id)
        if not found: raise NotFoundError("Paper not found")
        self.search_index.delete_paper(id)
        # R2 objects are intentionally retained so re-importing the URL reuses cached parsing results.

    def start_decoding(self, id):
        if not self.papers.get(id): raise NotFoundError("Paper not found")
        self.papers.set_status(id, "pending"); return self.papers.get(id)

    async def decode(self, id, user_id=None):
        paper = self.papers.get(id)
        if not paper: return
        if paper.get("isDecoded"): return
        self.papers.set_status(id, "processing")
        try:
            r2 = R2ObjectStore(user_id=user_id)
            # Check R2 cache first before invoking MinerU API
            try:
                cached_artifacts = r2.list_cached_artifacts(id)
            except Exception:
                cached_artifacts = []
            if any(a.archive_path.endswith(".md") and not a.archive_path.startswith("translations/") for a in cached_artifacts):
                self.papers.save_artifacts(id, cached_artifacts)
                self.reindex_paper(id)
                return

            mineru_client = MinerUClient(user_id=user_id)
            result = await mineru_client.parse_url(paper["url"])
            self.papers.save_artifacts(id, r2.put_archive(id, result.files))
            self.reindex_paper(id)
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

    def content_list(self, id: str) -> list[dict]:
        """Read MinerU's reading-order content list, the canonical bbox source."""
        from ..infrastructure.database import SessionLocal
        from ..infrastructure.orm_models import DocumentArtifactRecord
        from sqlalchemy import select

        with SessionLocal() as session:
            artifacts = list(session.scalars(select(DocumentArtifactRecord).where(
                DocumentArtifactRecord.document_id == id,
                DocumentArtifactRecord.kind == "json",
            )))
        artifact = next((item for item in artifacts if item.archive_path.endswith("_content_list.json")), None)
        if not artifact:
            return []
        try:
            payload = json.loads(R2ObjectStore().read(artifact.object_key))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return []
        return payload if isinstance(payload, list) else []

    @staticmethod
    def content_list_markdown(item: dict) -> str:
        item_type = item.get("type")
        if item_type in {"text", "ref_text"}:
            text = str(item.get("text") or "").strip()
            if item_type == "text" and isinstance(item.get("text_level"), int) and item["text_level"] > 0:
                return f"{'#' * min(item['text_level'], 6)} {text}" if text else ""
            return text
        if item_type == "equation":
            return str(item.get("text") or "").strip()
        if item_type in {"image", "chart"}:
            captions = item.get("image_caption" if item_type == "image" else "chart_caption") or []
            caption = " ".join(str(value) for value in captions).strip()
            image_path = str(item.get("img_path") or "").strip()
            return f"![{caption}]({image_path})" if image_path else caption
        if item_type == "table":
            caption = " ".join(str(value) for value in (item.get("table_caption") or [])).strip()
            body = str(item.get("table_body") or "").strip()
            return "\n\n".join(value for value in (caption, body) if value)
        if item_type == "code":
            return str(item.get("code_body") or "").strip()
        return ""

    def markdown_blocks(self, id: str) -> list[dict]:
        """Expose compact, bbox-addressable Markdown blocks in MinerU reading order."""
        ignored_types = {"aside_text", "header", "footer", "page_number", "page_footnote"}
        blocks: list[dict] = []
        for source_index, item in enumerate(self.content_list(id)):
            if not isinstance(item, dict) or item.get("type") in ignored_types:
                continue
            content = self.content_list_markdown(item)
            bbox = item.get("bbox")
            page_index = item.get("page_idx")
            if not content or not isinstance(page_index, int) or not isinstance(bbox, list) or len(bbox) != 4:
                continue
            if not all(isinstance(value, (int, float)) for value in bbox):
                continue
            x0, y0, x1, y1 = (max(0, min(1000, value)) for value in bbox)
            if x1 <= x0 or y1 <= y0:
                continue
            blocks.append({
                "id": f"content:{source_index}",
                "index": source_index,
                "content": content,
                "pageIndex": page_index,
                "bbox": [x0, y0, x1, y1],
                "type": str(item.get("type", "content")),
            })
        return blocks

    def markdown_block_indices(self, id: str) -> set[int]:
        blocks = self.markdown_blocks(id)
        if blocks:
            return {block["index"] for block in blocks}
        content, _ = self.markdown(id)
        sections = [part.strip() for part in re.split(r"(?=^#{1,6}\s)", content, flags=re.MULTILINE) if part.strip()]
        return set(range(len(sections) or 1))

    def translated_markdown_blocks(self, id: str, target_language: str) -> list[dict]:
        translated, _ = self.translated_markdown(id, target_language)
        metadata = {block["index"]: block for block in self.markdown_blocks(id)}
        pieces = re.split(r"^\s*<!-- mineru-block:(\d+) -->\s*$", translated, flags=re.MULTILINE)
        blocks: list[dict] = []
        for position in range(1, len(pieces), 2):
            index, content = int(pieces[position]), pieces[position + 1].strip()
            source = metadata.get(index)
            if source and content:
                blocks.append({**source, "content": content})
        return blocks

    def layout_boxes(self, id: str) -> list[dict]:
        """Return the same content-list bboxes used by the Markdown view."""
        return [{
            "id": block["id"],
            "blockIndex": block["index"],
            "pageIndex": block["pageIndex"],
            "pageWidth": 1000,
            "pageHeight": 1000,
            "x0": block["bbox"][0],
            "y0": block["bbox"][1],
            "x1": block["bbox"][2],
            "y1": block["bbox"][3],
            "type": block["type"],
        } for block in self.markdown_blocks(id)]

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

    @staticmethod
    def _fallback_search_blocks(content: str) -> list[dict]:
        sections = [part.strip() for part in re.split(r"(?=^#{1,6}\s)", content, flags=re.MULTILINE) if part.strip()]
        return [{"index": index, "content": section} for index, section in enumerate(sections or [content])]

    def reindex_paper(self, id: str) -> None:
        """Replace all searchable material for one paper atomically."""
        paper = self.papers.get(id)
        if not paper:
            self.search_index.delete_paper(id)
            return
        title = paper["title"]
        documents = [{"source": "paper", "title": title, "content": f"{title}\n{paper['url']}"}]
        if paper.get("isDecoded"):
            source_blocks = self.markdown_blocks(id)
            if not source_blocks:
                try:
                    markdown, _ = self.markdown(id)
                    source_blocks = self._fallback_search_blocks(markdown)
                except Exception:
                    source_blocks = []
            # The MinerU reading-order blocks are the textual representation of
            # the parsed PDF; index them separately from Markdown by design.
            for source in ("pdf", "markdown"):
                documents.extend({
                    "source": source,
                    "title": title,
                    "blockIndex": block.get("index"),
                    "pageIndex": block.get("pageIndex"),
                    "content": block.get("content", ""),
                } for block in source_blocks)
            for translation in paper.get("translations", []):
                language = translation["targetLanguage"]
                try:
                    translated, _ = self.translated_markdown(id, language)
                    blocks = self.translated_markdown_blocks(id, language) or self._fallback_search_blocks(translated)
                except Exception:
                    continue
                documents.extend({
                    "source": "translate",
                    "language": language,
                    "title": title,
                    "blockIndex": block.get("index"),
                    "pageIndex": block.get("pageIndex"),
                    "content": block.get("content", ""),
                } for block in blocks)
        self.search_index.replace_paper(id, documents)

    def rebuild_search_indexes(self) -> None:
        for paper in self.papers.list():
            try:
                self.reindex_paper(paper["id"])
            except Exception:
                # A temporary R2 issue must not prevent the application booting.
                continue

    def search(self, query: str, limit: int = 30) -> list[dict]:
        return self.search_index.search(query, limit)

    async def translate_markdown(self, id: str, target_language: str, user_id: str | None = None):
        paper = self.paper(id)
        language = self.translation_language(target_language)
        source, source_artifact = self.markdown(id)
        canonical_blocks = self.markdown_blocks(id)
        if canonical_blocks:
            source = "\n\n".join(f"<!-- mineru-block:{block['index']} -->\n{block['content']}" for block in canonical_blocks)
        archive_path = self.translation_path(language["code"], source_artifact.archive_path)
        cfg = self.config.get_for_user(user_id, masked=False)
        instruction = "You translate academic Markdown. Return only translated Markdown. Translate prose only; preserve every Markdown construct, headings, lists, tables, links, URLs, image paths, HTML, code fences, inline code, LaTex/math, citations, and whitespace/layout. Do not add or remove sections. HTML comments in the form <!-- mineru-block:N --> are structural block markers: preserve each one exactly, in the same order."
        translated = await self.llm.generate(
            cfg,
            f"Target language: {language['name']} ({language['code']})\n\nMarkdown to translate:\n{source}",
            system_instruction=instruction,
        )
        if not translated.strip(): raise ValidationError("The translation model returned an empty document.")
        stored = R2ObjectStore(user_id=user_id).put(id, archive_path, translated.encode("utf-8"))
        self.papers.save_translation(id, stored, language["code"])
        self.reindex_paper(id)
        return {"paperId": paper["id"], "targetLanguage": language["code"], "archivePath": archive_path, "content": translated}

    async def enqueue_translation(self, id: str, target_language: str, user_id: str | None = None):
        self.paper(id)
        self.markdown(id)  # Fail fast when parsing has not completed.
        language = self.translation_language(target_language)
        job, _ = self.papers.enqueue_translation(id, language["code"], self.now())
        self.schedule_translation(id, user_id=user_id)
        return job

    def schedule_translation(self, id: str, user_id: str | None = None):
        current = self._translation_tasks.get(id)
        if current and not current.done(): return
        task = asyncio.create_task(self.run_translation_job(id, user_id=user_id), name=f"translation:{id}")
        self._translation_tasks[id] = task
        task.add_done_callback(lambda _: self._translation_tasks.pop(id, None))

    async def run_translation_job(self, id: str, user_id: str | None = None):
        job = self.papers.claim_translation(id, self.now())
        if not job: return
        try:
            await self.translate_markdown(id, job["targetLanguage"], user_id=user_id)
        except Exception as error:
            self.papers.finish_translation(id, "failed", str(error), self.now())
        else:
            self.papers.finish_translation(id, "done", None, self.now())

    async def recover_translation_jobs(self):
        for id in self.papers.resume_translation_jobs(self.now()):
            self.schedule_translation(id)

    async def chat(self, id: str, message: str, user_id: str | None = None):
        paper = self.papers.get(id)
        if not paper: raise NotFoundError("Paper not found")
        cfg = self.config.get_for_user(user_id, masked=False)
        user_msg = {"id": f"msg_{uuid4().hex[:8]}", "paperId": id, "role": "user", "content": message, "createdAt": self.now()}
        self.collaboration.add_message(user_msg, user_id=user_id)
        try:
            markdown_content, _ = self.markdown(id)
        except Exception:
            markdown_content = ""
        system_prompt = (
            f"You are an expert AI research assistant analyzing the paper titled '{paper['title']}'.\n"
            f"Paper URL: {paper['url']}\n"
            f"Parsed Content (Markdown):\n{markdown_content[:15000]}\n"
        )
        reply = await self.llm.generate(cfg, message, system_instruction=system_prompt)
        assistant_msg = {"id": f"msg_{uuid4().hex[:8]}", "paperId": id, "role": "assistant", "content": reply, "createdAt": self.now()}
        self.collaboration.add_message(assistant_msg, user_id=user_id)

        if user_id:
            try:
                all_msgs = self.collaboration.messages(id, user_id=user_id)
                chat_data = json.dumps(all_msgs, ensure_ascii=False, indent=2).encode("utf-8")
                archive_path = f"chats/{user_id}.json"
                R2ObjectStore(user_id=user_id).put(id, archive_path, chat_data)
            except Exception:
                pass

        return assistant_msg

    async def chat_stream(self, id: str, message: str, user_id: str | None = None):
        """Async generator for streaming chat. Yields str chunks, then the saved assistant ChatMessage dict."""
        paper = self.papers.get(id)
        if not paper: raise NotFoundError("Paper not found")
        cfg = self.config.get_for_user(user_id, masked=False)
        user_msg = {"id": f"msg_{uuid4().hex[:8]}", "paperId": id, "role": "user", "content": message, "createdAt": self.now()}
        self.collaboration.add_message(user_msg, user_id=user_id)
        try:
            markdown_content, _ = self.markdown(id)
        except Exception:
            markdown_content = ""
        system_prompt = (
            f"You are an expert AI research assistant analyzing the paper titled '{paper['title']}'.\n"
            f"Paper URL: {paper['url']}\n"
            f"Parsed Content (Markdown):\n{markdown_content[:15000]}\n"
        )
        parts: list[str] = []
        async for chunk in self.llm.generate_stream(cfg, message, system_instruction=system_prompt):
            parts.append(chunk)
            yield chunk  # stream text chunk to caller

        reply_text = "".join(parts)
        if reply_text.strip():
            assistant_msg = {"id": f"msg_{uuid4().hex[:8]}", "paperId": id, "role": "assistant", "content": reply_text, "createdAt": self.now()}
            self.collaboration.add_message(assistant_msg, user_id=user_id)
            if user_id:
                try:
                    all_msgs = self.collaboration.messages(id, user_id=user_id)
                    chat_data = json.dumps(all_msgs, ensure_ascii=False, indent=2).encode("utf-8")
                    R2ObjectStore(user_id=user_id).put(id, f"chats/{user_id}.json", chat_data)
                except Exception:
                    pass
            yield assistant_msg  # final yield: the persisted message dict



    def clear_chat(self, id: str, user_id: str | None = None):
        self.collaboration.clear_messages(id, user_id=user_id)
        if user_id:
            try:
                archive_path = f"chats/{user_id}.json"
                R2ObjectStore(user_id=user_id).put(id, archive_path, b"[]")
            except Exception:
                pass

    async def action(self, id: str, payload: dict, user_id: str | None = None):
        paper = self.papers.get(id)
        if not paper: raise NotFoundError("Paper not found")
        action_type = payload.get("action")
        target_lang = payload.get("targetLanguage", "Chinese (简体中文)")
        cfg = self.config.get_for_user(user_id, masked=False)
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




