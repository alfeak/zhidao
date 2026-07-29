from sqlalchemy import select
import hashlib
import os
from .database import SessionLocal
from .orm_models import DocumentRecord, DocumentArtifactRecord, TranslationJobRecord, ChatMessageRecord, RemarkRecord, ModelRecord
from ..domain.translation_languages import TRANSLATION_LANGUAGE_BY_CODE

ACTIVE_TRANSLATION_STATUSES = {"pending", "processing"}

def translation_job_dict(job):
    return {"targetLanguage": job.target_language, "status": job.status, "error": job.error, "createdAt": job.created_at, "updatedAt": job.updated_at}

def document_dict(doc):
    markdown = next((a for a in doc.artifacts if a.kind == "markdown"), None)
    translations = [{"targetLanguage": a.translation_language or translation_language_from_path(a.archive_path), "archivePath": a.archive_path} for a in doc.artifacts if a.kind == "translation"]
    translations = [item for item in translations if item["targetLanguage"]]
    translations.sort(key=lambda item: item["targetLanguage"])
    result = {"id": doc.id, "title": doc.title, "url": doc.source_url, "isDecoded": doc.decode_status == "done", "decodeStatus": doc.decode_status, "decodeError": doc.decode_error, "importedAt": doc.imported_at, "markdownObjectKey": markdown.object_key if markdown else None}
    if translations: result["translations"] = translations
    if doc.translation_job: result["translationJob"] = translation_job_dict(doc.translation_job)
    return result

def artifact_kind(artifact):
    if artifact.archive_path.startswith("translations/") and artifact.archive_path.endswith(".md"): return "translation"
    if artifact.archive_path.endswith(".md"): return "markdown"
    if artifact.archive_path.endswith(".pdf"): return "pdf"
    if artifact.content_type.startswith("image/"): return "image"
    if artifact.archive_path.endswith(".json"): return "json"
    return "other"

def translation_language_from_path(path: str) -> str | None:
    if not path.startswith("translations/") or not path.endswith(".md"):
        return None
    stem = path.removesuffix(".md").rsplit(".", 1)[-1]
    return stem if stem in TRANSLATION_LANGUAGE_BY_CODE else None

class PaperRepository:
    def list(self):
        with SessionLocal() as s: return [document_dict(x) for x in s.scalars(select(DocumentRecord).order_by(DocumentRecord.imported_at.desc())).unique()]
    def get(self, id):
        with SessionLocal() as s:
            x=s.get(DocumentRecord,id); return document_dict(x) if x else None
    def get_by_url(self, source_url):
        with SessionLocal() as s:
            x=s.scalar(select(DocumentRecord).where(DocumentRecord.source_url==source_url))
            return document_dict(x) if x else None
    def create(self, p):
        with SessionLocal.begin() as s:
            x=s.get(DocumentRecord, p["id"])
            if not x:
                s.add(DocumentRecord(id=p["id"],title=p["title"],source_url=p["url"],imported_at=p["importedAt"]))
            else:
                x.title=p["title"]
                x.source_url=p["url"]
                x.imported_at=p["importedAt"]
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
            for n,a in enumerate(artifacts): s.add(DocumentArtifactRecord(id=f"{id}_{n}",document_id=id,archive_path=a.archive_path,object_key=a.object_key,kind=artifact_kind(a),content_type=a.content_type,byte_size=a.byte_size,sha256=a.sha256,translation_language=translation_language_from_path(a.archive_path)))
    def save_translation(self, id, artifact, language_code):
        with SessionLocal.begin() as s:
            existing = s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id == id, DocumentArtifactRecord.archive_path == artifact.archive_path))
            if existing:
                existing.object_key, existing.kind = artifact.object_key, "translation"
                existing.content_type, existing.byte_size, existing.sha256, existing.translation_language = artifact.content_type, artifact.byte_size, artifact.sha256, language_code
            else:
                s.add(DocumentArtifactRecord(id=f"{id}_translation_{hashlib.sha256(artifact.archive_path.encode('utf-8')).hexdigest()[:16]}", document_id=id, archive_path=artifact.archive_path, object_key=artifact.object_key, kind="translation", content_type=artifact.content_type, byte_size=artifact.byte_size, sha256=artifact.sha256, translation_language=language_code))
    def enqueue_translation(self, id, target_language, now):
        with SessionLocal.begin() as s:
            job = s.scalar(select(TranslationJobRecord).where(TranslationJobRecord.document_id == id))
            if job and job.status in ACTIVE_TRANSLATION_STATUSES:
                return translation_job_dict(job), False
            if not job:
                job = TranslationJobRecord(id=f"translation_{id}", document_id=id, target_language=target_language, status="pending", error=None, created_at=now, updated_at=now)
                s.add(job)
            else:
                job.target_language, job.status, job.error, job.updated_at = target_language, "pending", None, now
            return translation_job_dict(job), True
    def claim_translation(self, id, now):
        with SessionLocal.begin() as s:
            job = s.scalar(select(TranslationJobRecord).where(TranslationJobRecord.document_id == id))
            if not job or job.status != "pending": return None
            job.status, job.updated_at = "processing", now
            return translation_job_dict(job)
    def finish_translation(self, id, status, error, now):
        with SessionLocal.begin() as s:
            job = s.scalar(select(TranslationJobRecord).where(TranslationJobRecord.document_id == id))
            if job:
                job.status, job.error, job.updated_at = status, error, now
    def resume_translation_jobs(self, now):
        with SessionLocal.begin() as s:
            jobs = list(s.scalars(select(TranslationJobRecord).where(TranslationJobRecord.status.in_(ACTIVE_TRANSLATION_STATUSES))))
            for job in jobs:
                job.status, job.updated_at = "pending", now
            return [job.document_id for job in jobs]
    def artifact(self,id,path):
        with SessionLocal() as s:return s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id==id,DocumentArtifactRecord.archive_path==path))
    def delete(self,id):
        with SessionLocal.begin() as s:
            x=s.get(DocumentRecord,id)
            if not x:return False, None
            prefix=x.object_prefix; s.delete(x); return True, prefix


class ConfigRepository:
    def get(self, masked=True):
        api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        if not api_key:
            return {"models": []}
        return {"models": [{
            "id": "model_deepseek",
            "name": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro").strip(),
            "apiKey": "••••••••" if masked else api_key,
            "baseUrl": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip(),
            "isPrimary": True,
        }]}
    def update(self,payload): return self.get()

class CollaborationRepository:
    def messages(self,paper_id): return []
    def add_message(self,message): pass
    def clear_messages(self,paper_id): pass
    @staticmethod
    def remark_dict(remark):
        return {
            "id": remark.id,
            "paperId": remark.document_id,
            "blockIndex": remark.block_index,
            "comment": remark.comment,
            "color": remark.color,
            "createdAt": remark.created_at,
        }

    def remarks(self, paper_id):
        with SessionLocal() as session:
            records = session.scalars(
                select(RemarkRecord)
                .where(RemarkRecord.document_id == paper_id, RemarkRecord.block_index.is_not(None))
                .order_by(RemarkRecord.block_index, RemarkRecord.created_at)
            )
            return [self.remark_dict(record) for record in records]

    def add_remark(self, remark):
        with SessionLocal.begin() as session:
            if not session.get(DocumentRecord, remark["paperId"]):
                return None
            record = RemarkRecord(
                id=remark["id"],
                document_id=remark["paperId"],
                block_index=remark["blockIndex"],
                # Keep the old required column populated for schema compatibility.
                block_id=f"block_{remark['blockIndex']}",
                comment=remark["comment"],
                color=remark["color"],
                created_at=remark["createdAt"],
            )
            session.add(record)
            return self.remark_dict(record)

    def delete_remark(self, remark_id):
        with SessionLocal.begin() as session:
            record = session.get(RemarkRecord, remark_id)
            if not record:
                return False
            session.delete(record)
            return True


