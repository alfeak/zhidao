import hashlib
import json
from uuid import uuid4
from sqlalchemy import select
from .database import SessionLocal
from .orm_models import (
    DocumentRecord, DocumentArtifactRecord, TranslationJobRecord,
    ChatMessageRecord, RemarkRecord, UserSettingsRecord,
)
from ..domain.translation_languages import TRANSLATION_LANGUAGE_BY_CODE

ACTIVE_TRANSLATION_STATUSES = {"pending", "processing"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# PaperRepository
# ---------------------------------------------------------------------------

class PaperRepository:
    def list(self):
        with SessionLocal() as s: return [document_dict(x) for x in s.scalars(select(DocumentRecord).order_by(DocumentRecord.imported_at.desc())).unique()]
    def get(self, id):
        with SessionLocal() as s:
            x = s.get(DocumentRecord, id); return document_dict(x) if x else None
    def get_by_url(self, source_url):
        with SessionLocal() as s:
            x = s.scalar(select(DocumentRecord).where(DocumentRecord.source_url == source_url))
            return document_dict(x) if x else None
    def create(self, p):
        with SessionLocal.begin() as s:
            x = s.get(DocumentRecord, p["id"])
            if not x:
                s.add(DocumentRecord(id=p["id"], title=p["title"], source_url=p["url"], imported_at=p["importedAt"]))
            else:
                x.title = p["title"]; x.source_url = p["url"]; x.imported_at = p["importedAt"]
        return self.get(p["id"])
    def set_status(self, id, status, error=None):
        with SessionLocal.begin() as s:
            x = s.get(DocumentRecord, id)
            if x: x.decode_status, x.decode_error = status, error
    def save_artifacts(self, id, artifacts):
        with SessionLocal.begin() as s:
            x = s.get(DocumentRecord, id)
            if not x: return
            x.decode_status, x.decode_error = "done", None
            x.artifacts.clear()
            # Flush deletions before reusing the same object keys on retry/re-import.
            s.flush()
            for n, a in enumerate(artifacts):
                s.add(DocumentArtifactRecord(id=f"{id}_{n}", document_id=id, archive_path=a.archive_path, object_key=a.object_key, kind=artifact_kind(a), content_type=a.content_type, byte_size=a.byte_size, sha256=a.sha256, translation_language=translation_language_from_path(a.archive_path)))
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
            if job: job.status, job.error, job.updated_at = status, error, now
    def resume_translation_jobs(self, now):
        with SessionLocal.begin() as s:
            jobs = list(s.scalars(select(TranslationJobRecord).where(TranslationJobRecord.status.in_(ACTIVE_TRANSLATION_STATUSES))))
            for job in jobs: job.status, job.updated_at = "pending", now
            return [job.document_id for job in jobs]
    def artifact(self, id, path):
        with SessionLocal() as s: return s.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id == id, DocumentArtifactRecord.archive_path == path))
    def delete(self, id):
        with SessionLocal.begin() as s:
            x = s.get(DocumentRecord, id)
            if not x: return False, None
            prefix = x.object_prefix; s.delete(x); return True, prefix

# ---------------------------------------------------------------------------
# UserSettingsRepository
# Source of truth: configs_json blob only. No legacy single-field columns.
# ---------------------------------------------------------------------------

class UserSettingsRepository:
    @staticmethod
    def _parse_configs(rec: UserSettingsRecord) -> dict:
        """Return the raw configs dict stored in configs_json, or empty defaults."""
        stored: dict = {}
        if rec and rec.configs_json:
            try:
                stored = json.loads(rec.configs_json)
            except Exception:
                stored = {}
        return stored

    @staticmethod
    def get_user_settings(user_id: str) -> dict:
        """Return full settings for the given user.

        Flat convenience fields (llmApiKey, mineruToken, …) are derived from
        the primary entry in each *Configs list so callers don't need to know
        about the list structure.
        """
        with SessionLocal() as s:
            rec = s.get(UserSettingsRecord, user_id)

        stored = UserSettingsRepository._parse_configs(rec)

        mineru_configs: list[dict] = stored.get("mineruConfigs") or []
        llm_configs: list[dict] = stored.get("llmConfigs") or []
        r2_configs: list[dict] = stored.get("r2Configs") or []

        primary_mineru = next((c for c in mineru_configs if c.get("isPrimary")), mineru_configs[0] if mineru_configs else {})
        primary_llm    = next((c for c in llm_configs    if c.get("isPrimary")), llm_configs[0]    if llm_configs    else {})
        primary_r2     = next((c for c in r2_configs     if c.get("isPrimary")), r2_configs[0]     if r2_configs     else {})

        return {
            "mineruConfigs": mineru_configs,
            "llmConfigs":    llm_configs,
            "r2Configs":     r2_configs,
            # Flat convenience fields derived from the primary config
            "mineruToken":        primary_mineru.get("mineruToken") or "",
            "mineruBaseUrl":      primary_mineru.get("mineruBaseUrl") or "",
            "llmModel":           primary_llm.get("llmModel") or "",
            "llmApiKey":          primary_llm.get("llmApiKey") or "",
            "llmBaseUrl":         primary_llm.get("llmBaseUrl") or "",
            "r2AccountId":        primary_r2.get("r2AccountId") or "",
            "r2Bucket":           primary_r2.get("r2Bucket") or "",
            "r2AccessKeyId":      primary_r2.get("r2AccessKeyId") or "",
            "r2SecretAccessKey":  primary_r2.get("r2SecretAccessKey") or "",
            "r2EndpointUrl":      primary_r2.get("r2EndpointUrl") or "",
            "r2Prefix":           primary_r2.get("r2Prefix") or "",
        }

    @staticmethod
    def update_user_settings(user_id: str, payload: dict) -> dict:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        existing = UserSettingsRepository.get_user_settings(user_id)

        mineru_configs = payload.get("mineruConfigs") or existing.get("mineruConfigs") or []
        llm_configs    = payload.get("llmConfigs")    or existing.get("llmConfigs")    or []
        r2_configs     = payload.get("r2Configs")     or existing.get("r2Configs")     or []

        # Restore masked sensitive values and trim accidental whitespace from pasted credentials
        def restore_mineru(c):
            ex = next((e for e in existing.get("mineruConfigs", []) if e.get("id") == c.get("id")), {})
            token = c.get("mineruToken", "")
            if str(token).startswith("•••"):
                token = ex.get("mineruToken") or ""
            return {**c, "mineruToken": str(token).strip(), "mineruBaseUrl": str(c.get("mineruBaseUrl") or "").strip()}

        def restore_llm(c):
            ex = next((e for e in existing.get("llmConfigs", []) if e.get("id") == c.get("id")), {})
            key = c.get("llmApiKey", "")
            if str(key).startswith("•••"):
                key = ex.get("llmApiKey") or ""
            return {**c, "llmApiKey": str(key).strip(), "llmBaseUrl": str(c.get("llmBaseUrl") or "").strip(), "llmModel": str(c.get("llmModel") or "").strip()}

        def restore_r2(c):
            ex = next((e for e in existing.get("r2Configs", []) if e.get("id") == c.get("id")), {})
            secret = c.get("r2SecretAccessKey", "")
            if str(secret).startswith("•••"):
                secret = ex.get("r2SecretAccessKey") or ""
            return {
                **c,
                "r2SecretAccessKey": str(secret).strip(),
                "r2AccessKeyId": str(c.get("r2AccessKeyId") or "").strip(),
                "r2Bucket": str(c.get("r2Bucket") or "").strip(),
                "r2AccountId": str(c.get("r2AccountId") or "").strip(),
                "r2EndpointUrl": str(c.get("r2EndpointUrl") or "").strip(),
                "r2Prefix": str(c.get("r2Prefix") or "").strip(),
            }

        mineru_configs = [restore_mineru(c) for c in mineru_configs]
        llm_configs    = [restore_llm(c)    for c in llm_configs]
        r2_configs     = [restore_r2(c)     for c in r2_configs]

        new_json = json.dumps({"mineruConfigs": mineru_configs, "llmConfigs": llm_configs, "r2Configs": r2_configs}, ensure_ascii=False)

        with SessionLocal.begin() as s:
            rec = s.get(UserSettingsRecord, user_id)
            if not rec:
                rec = UserSettingsRecord(user_id=user_id, updated_at=now)
                s.add(rec)
            rec.configs_json = new_json
            rec.updated_at = now

        return UserSettingsRepository.get_user_settings(user_id)

# ---------------------------------------------------------------------------
# ConfigRepository
# ---------------------------------------------------------------------------

class ConfigRepository:
    def get_for_user(self, user_id: str | None = None, masked: bool = True) -> dict:
        user_settings = UserSettingsRepository.get_user_settings(user_id) if user_id else {}

        llm_configs    = user_settings.get("llmConfigs")    or []
        mineru_configs = user_settings.get("mineruConfigs") or []
        r2_configs     = user_settings.get("r2Configs")     or []

        def mask_val(v):
            return "••••••••" if masked and v else v

        masked_llm_configs    = [{**c, "llmApiKey":         mask_val(c.get("llmApiKey", ""))}         for c in llm_configs]
        masked_mineru_configs = [{**c, "mineruToken":       mask_val(c.get("mineruToken", ""))}       for c in mineru_configs]
        masked_r2_configs     = [{**c, "r2SecretAccessKey": mask_val(c.get("r2SecretAccessKey", ""))} for c in r2_configs]

        # Build the models list consumed by OpenAICompatibleGateway
        models_list = [{
            "id":        c.get("id", "llm"),
            "name":      c.get("llmModel") or "",
            "apiKey":    mask_val(c.get("llmApiKey") or "") if masked else (c.get("llmApiKey") or ""),
            "baseUrl":   c.get("llmBaseUrl") or "",
            "isPrimary": bool(c.get("isPrimary")),
        } for c in llm_configs]

        if models_list and not any(m.get("isPrimary") for m in models_list):
            models_list[0]["isPrimary"] = True

        return {
            "llmConfigs":    masked_llm_configs,
            "mineruConfigs": masked_mineru_configs,
            "r2Configs":     masked_r2_configs,
            # Flat convenience fields (derived from primary)
            "llmModel":          user_settings.get("llmModel") or "",
            "llmApiKey":         mask_val(user_settings.get("llmApiKey") or ""),
            "llmBaseUrl":        user_settings.get("llmBaseUrl") or "",
            "mineruToken":       mask_val(user_settings.get("mineruToken") or ""),
            "mineruBaseUrl":     user_settings.get("mineruBaseUrl") or "",
            "r2AccountId":       user_settings.get("r2AccountId") or "",
            "r2Bucket":          user_settings.get("r2Bucket") or "",
            "r2AccessKeyId":     user_settings.get("r2AccessKeyId") or "",
            "r2SecretAccessKey": mask_val(user_settings.get("r2SecretAccessKey") or ""),
            "r2EndpointUrl":     user_settings.get("r2EndpointUrl") or "",
            "r2Prefix":          user_settings.get("r2Prefix") or "",
            "models":            models_list,
        }

    def update_for_user(self, user_id: str | None, payload: dict) -> dict:
        if user_id:
            UserSettingsRepository.update_user_settings(user_id, payload)
        return self.get_for_user(user_id, masked=True)

# ---------------------------------------------------------------------------
# CollaborationRepository
# ---------------------------------------------------------------------------

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
                id=message.get("id", f"msg_{uuid4().hex[:12]}"),
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
        return {"id": remark.id, "paperId": remark.document_id, "blockIndex": remark.block_index, "comment": remark.comment, "color": remark.color, "createdAt": remark.created_at}

    def remarks(self, paper_id, user_id: str | None = None):
        with SessionLocal() as session:
            stmt = select(RemarkRecord).where(RemarkRecord.document_id == paper_id, RemarkRecord.block_index.is_not(None))
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
