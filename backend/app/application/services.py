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
        self.papers,self.config,self.collaboration=PaperRepository(),ConfigRepository(),CollaborationRepository()
        self.mineru=MinerUClient(); self.title_resolver=PaperTitleResolver()
    @staticmethod
    def now(): return datetime.now(timezone.utc).isoformat()
    @staticmethod
    def identifier(p): return f"{p}_{uuid4().hex}"
    def list_papers(self): return self.papers.list()
    async def import_paper(self,url,title=None):
        if not url or not url.strip(): raise ValidationError("Paper URL is required")
        r=await self.title_resolver.resolve(url,title)
        return self.papers.create({"id":self.identifier("paper"),"title":r.title,"url":r.url,"importedAt":self.now()})
    def delete_paper(self,id):
        found, prefix=self.papers.delete(id)
        if not found: raise NotFoundError("Paper not found")
        if prefix: R2ObjectStore().delete_prefix(prefix)
    def start_decoding(self,id):
        if not self.papers.get(id): raise NotFoundError("Paper not found")
        self.papers.set_status(id,"pending"); return self.papers.get(id)
    async def decode(self,id):
        paper=self.papers.get(id)
        if not paper:return
        self.papers.set_status(id,"processing")
        try:
            result=await self.mineru.parse_url(paper["url"])
            self.papers.save_artifacts(id,R2ObjectStore().put_archive(id,result.files))
        except Exception as e:self.papers.set_status(id,"failed",str(e))
    def artifact(self,id,path):
        a=self.papers.artifact(id,path)
        if not a: raise NotFoundError("Document object was not found.")
        return a
    def markdown(self,id):
        a=next((self.papers.artifact(id,p) for p in []),None)
        # Query returned metadata is intentionally the only local document content.
        from ..infrastructure.database import SessionLocal
        from ..infrastructure.orm_models import DocumentArtifactRecord
        from sqlalchemy import select
        with SessionLocal() as s: a=s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id==id,DocumentArtifactRecord.kind=="markdown"))
        if not a: raise NotFoundError("Markdown was not found.")
        return R2ObjectStore().read(a.object_key).decode("utf-8"), a


