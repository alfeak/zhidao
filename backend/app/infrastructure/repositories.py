from sqlalchemy import select
from .database import SessionLocal
from .orm_models import DocumentRecord, DocumentArtifactRecord, ChatMessageRecord, RemarkRecord, ModelRecord

def document_dict(doc):
    markdown = next((a for a in doc.artifacts if a.kind == "markdown"), None)
    return {"id": doc.id, "title": doc.title, "url": doc.source_url, "isDecoded": doc.decode_status == "done", "decodeStatus": doc.decode_status, "decodeError": doc.decode_error, "importedAt": doc.imported_at, "markdownObjectKey": markdown.object_key if markdown else None}

class PaperRepository:
    def list(self):
        with SessionLocal() as s: return [document_dict(x) for x in s.scalars(select(DocumentRecord).order_by(DocumentRecord.imported_at.desc())).unique()]
    def get(self, id):
        with SessionLocal() as s:
            x=s.get(DocumentRecord,id); return document_dict(x) if x else None
    def create(self, p):
        with SessionLocal.begin() as s: s.add(DocumentRecord(id=p["id"],title=p["title"],source_url=p["url"],imported_at=p["importedAt"]))
        return self.get(p["id"])
    def set_status(self,id,status,error=None):
        with SessionLocal.begin() as s:
            x=s.get(DocumentRecord,id)
            if x: x.decode_status,x.decode_error=status,error
    def save_artifacts(self,id, artifacts):
        with SessionLocal.begin() as s:
            x=s.get(DocumentRecord,id)
            if not x:return
            x.decode_status,x.decode_error="done",None
            x.artifacts.clear()
            for n,a in enumerate(artifacts): s.add(DocumentArtifactRecord(id=f"{id}_{n}",document_id=id,archive_path=a.archive_path,object_key=a.object_key,kind=("markdown" if a.archive_path.endswith(".md") else "pdf" if a.archive_path.endswith(".pdf") else "image" if a.content_type.startswith("image/") else "json" if a.archive_path.endswith(".json") else "other"),content_type=a.content_type,byte_size=a.byte_size,sha256=a.sha256))
    def artifact(self,id,path):
        with SessionLocal() as s:return s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id==id,DocumentArtifactRecord.archive_path==path))
    def delete(self,id):
        with SessionLocal.begin() as s:
            x=s.get(DocumentRecord,id)
            if not x:return False, None
            prefix=x.object_prefix; s.delete(x); return True, prefix

class ConfigRepository:
    def get(self,masked=True): return {"models":[]}
    def update(self,payload): return self.get()

class CollaborationRepository:
    def messages(self,paper_id): return []
    def add_message(self,message): pass
    def clear_messages(self,paper_id): pass
    def remarks(self,paper_id): return []
    def add_remark(self,r): return r
    def delete_remark(self,id): pass


