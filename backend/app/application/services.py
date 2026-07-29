import hashlib
from datetime import datetime, timezone
from uuid import uuid4
import re
from ..domain.errors import NotFoundError, ValidationError
from ..infrastructure.mineru_client import MinerUClient
from ..infrastructure.object_store import R2ObjectStore
from ..infrastructure.repositories import PaperRepository, ConfigRepository, CollaborationRepository
from .paper_title_resolver import PaperTitleResolver

class PaperService:
    def __init__(self):
        self.papers, self.config, self.collaboration = PaperRepository(), ConfigRepository(), CollaborationRepository()
        self.mineru = MinerUClient(); self.title_resolver = PaperTitleResolver()

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



