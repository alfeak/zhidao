import hashlib
from datetime import datetime, timezone
from uuid import uuid4
import re
from ..domain.errors import NotFoundError, ValidationError
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

    @staticmethod
    def now(): return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def identifier_for_url(url: str) -> str:
        url_hash = hashlib.sha256(url.strip().encode("utf-8")).hexdigest()[:16]
        return f"paper_{url_hash}"

    def list_papers(self): return self.papers.list()

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

        has_markdown = any(a.archive_path.endswith(".md") for a in cached_artifacts)

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
            if any(a.archive_path.endswith(".md") for a in cached_artifacts):
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

    def markdown(self, id):
        from ..infrastructure.database import SessionLocal
        from ..infrastructure.orm_models import DocumentArtifactRecord
        from sqlalchemy import select
        with SessionLocal() as s:
            a = s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id == id, DocumentArtifactRecord.kind == "markdown"))
        if not a: raise NotFoundError("Markdown was not found.")
        return R2ObjectStore().read(a.object_key).decode("utf-8"), a

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




