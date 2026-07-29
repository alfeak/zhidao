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


class UserSettingsRepository:
    @staticmethod
    def get_user_settings(user_id: str | None) -> dict:
        if not user_id:
            return {}
        from .orm_models import UserSettingsRecord
        with SessionLocal() as s:
            rec = s.get(UserSettingsRecord, user_id)
            if not rec:
                return {}
            return {
                "mineruToken": rec.mineru_token or "",
                "mineruBaseUrl": rec.mineru_base_url or "",
                "llmModel": rec.llm_model or "",
                "llmApiKey": rec.llm_api_key or "",
                "llmBaseUrl": rec.llm_base_url or "",
                "r2AccountId": rec.r2_account_id or "",
                "r2Bucket": rec.r2_bucket or "",
                "r2AccessKeyId": rec.r2_access_key_id or "",
                "r2SecretAccessKey": rec.r2_secret_access_key or "",
                "r2EndpointUrl": rec.r2_endpoint_url or "",
                "r2Prefix": rec.r2_prefix or "",
            }

    @staticmethod
    def update_user_settings(user_id: str, payload: dict) -> dict:
        if not user_id:
            return {}
        from .orm_models import UserSettingsRecord
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        with SessionLocal.begin() as s:
            rec = s.get(UserSettingsRecord, user_id)
            if not rec:
                rec = UserSettingsRecord(user_id=user_id, updated_at=now)
                s.add(rec)
            
            if "mineruToken" in payload and not str(payload["mineruToken"]).startswith("•••"):
                rec.mineru_token = payload["mineruToken"]
            if "mineruBaseUrl" in payload:
                rec.mineru_base_url = payload["mineruBaseUrl"]
            if "llmModel" in payload:
                rec.llm_model = payload["llmModel"]
            if "llmApiKey" in payload and not str(payload["llmApiKey"]).startswith("•••"):
                rec.llm_api_key = payload["llmApiKey"]
            if "llmBaseUrl" in payload:
                rec.llm_base_url = payload["llmBaseUrl"]
            if "r2AccountId" in payload:
                rec.r2_account_id = payload["r2AccountId"]
            if "r2Bucket" in payload:
                rec.r2_bucket = payload["r2Bucket"]
            if "r2AccessKeyId" in payload:
                rec.r2_access_key_id = payload["r2AccessKeyId"]
            if "r2SecretAccessKey" in payload and not str(payload["r2SecretAccessKey"]).startswith("•••"):
                rec.r2_secret_access_key = payload["r2SecretAccessKey"]
            if "r2EndpointUrl" in payload:
                rec.r2_endpoint_url = payload["r2EndpointUrl"]
            if "r2Prefix" in payload:
                rec.r2_prefix = payload["r2Prefix"]
            rec.updated_at = now
        return UserSettingsRepository.get_user_settings(user_id)

class ConfigRepository:
    def get(self, masked=True):
        return self.get_for_user(None, masked)

    def get_for_user(self, user_id: str | None = None, masked: bool = True):
        user_settings = UserSettingsRepository.get_user_settings(user_id) if user_id else {}
        
        api_key = user_settings.get("llmApiKey") or os.getenv("DEEPSEEK_API_KEY", "").strip()
        model_name = user_settings.get("llmModel") or os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro").strip()
        base_url = user_settings.get("llmBaseUrl") or os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()

        mineru_token = user_settings.get("mineruToken") or os.getenv("MINERU_API_TOKEN", "").strip()
        mineru_base_url = user_settings.get("mineruBaseUrl") or os.getenv("MINERU_API_BASE_URL", "https://mineru.net/api/v4").strip()

        r2_account_id = user_settings.get("r2AccountId") or os.getenv("R2_ACCOUNT_ID", "").strip()
        r2_bucket = user_settings.get("r2Bucket") or os.getenv("R2_BUCKET", "").strip()
        r2_access_key_id = user_settings.get("r2AccessKeyId") or os.getenv("R2_ACCESS_KEY_ID", "").strip()
        r2_secret_access_key = user_settings.get("r2SecretAccessKey") or os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
        r2_endpoint_url = user_settings.get("r2EndpointUrl") or os.getenv("R2_ENDPOINT_URL", "").strip()
        r2_prefix = user_settings.get("r2Prefix") or os.getenv("R2_PREFIX", "mineru").strip()

        def mask_val(v):
            return "••••••••" if masked and v else v

        return {
            "mineruToken": mask_val(mineru_token),
            "mineruBaseUrl": mineru_base_url,
            "llmModel": model_name,
            "llmApiKey": mask_val(api_key),
            "llmBaseUrl": base_url,
            "r2AccountId": r2_account_id,
            "r2Bucket": r2_bucket,
            "r2AccessKeyId": r2_access_key_id,
            "r2SecretAccessKey": mask_val(r2_secret_access_key),
            "r2EndpointUrl": r2_endpoint_url,
            "r2Prefix": r2_prefix,
            "models": [{
                "id": "model_primary",
                "name": model_name,
                "apiKey": mask_val(api_key),
                "baseUrl": base_url,
                "isPrimary": True,
            }]
        }

    def update_for_user(self, user_id: str | None, payload: dict):
        if user_id:
            UserSettingsRepository.update_user_settings(user_id, payload)
        return self.get_for_user(user_id, masked=True)

    def update(self, payload):
        return self.get()

class CollaborationRepository:
    def messages(self, paper_id, user_id: str | None = None):
        if not user_id:
            return []
        with SessionLocal() as session:
            records = session.scalars(
                select(ChatMessageRecord)
                .where(ChatMessageRecord.document_id == paper_id, ChatMessageRecord.user_id == user_id)
                .order_by(ChatMessageRecord.created_at)
            )
            return [{"id": r.id, "paperId": r.document_id, "role": r.role, "content": r.content, "createdAt": r.created_at} for r in records]

    def add_message(self, message, user_id: str | None = None):
        with SessionLocal.begin() as session:
            record = ChatMessageRecord(
                id=message.get("id", f"msg_{uuid.uuid4().hex[:12]}"),
                document_id=message["paperId"],
                user_id=user_id,
                role=message["role"],
                content=message["content"],
                created_at=message["createdAt"],
            )
            session.add(record)
            return {"id": record.id, "paperId": record.document_id, "role": record.role, "content": record.content, "createdAt": record.created_at}

    def clear_messages(self, paper_id, user_id: str | None = None):
        with SessionLocal.begin() as session:
            stmt = select(ChatMessageRecord).where(ChatMessageRecord.document_id == paper_id)
            if user_id:
                stmt = stmt.where(ChatMessageRecord.user_id == user_id)
            for r in session.scalars(stmt):
                session.delete(r)

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

    def remarks(self, paper_id, user_id: str | None = None):
        with SessionLocal() as session:
            stmt = select(RemarkRecord).where(
                RemarkRecord.document_id == paper_id,
                RemarkRecord.block_index.is_not(None)
            )
            if user_id:
                stmt = stmt.where(RemarkRecord.user_id == user_id)
            records = session.scalars(stmt.order_by(RemarkRecord.block_index, RemarkRecord.created_at))
            return [self.remark_dict(record) for record in records]

    def add_remark(self, remark, user_id: str | None = None):
        with SessionLocal.begin() as session:
            if not session.get(DocumentRecord, remark["paperId"]):
                return None
            record = RemarkRecord(
                id=remark["id"],
                document_id=remark["paperId"],
                user_id=user_id,
                block_index=remark["blockIndex"],
                block_id=f"block_{remark['blockIndex']}",
                comment=remark["comment"],
                color=remark["color"],
                created_at=remark["createdAt"],
            )
            session.add(record)
            return self.remark_dict(record)

    def delete_remark(self, remark_id, user_id: str | None = None):
        with SessionLocal.begin() as session:
            stmt = select(RemarkRecord).where(RemarkRecord.id == remark_id)
            if user_id:
                stmt = stmt.where(RemarkRecord.user_id == user_id)
            record = session.scalar(stmt)
            if not record:
                return False
            session.delete(record)
            return True


