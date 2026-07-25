from pathlib import Path
import json
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from .orm_models import Base, SettingRecord, ModelRecord, PaperRecord, MarkdownBlockRecord, ChatMessageRecord, RemarkRecord

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATABASE_PATH = DATA_DIR / "zhidao.db"
LEGACY_DB_PATH = DATA_DIR / "db.json"
engine = create_engine(f"sqlite:///{DATABASE_PATH.as_posix()}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def initialize_database() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
    with SessionLocal.begin() as session:
        if session.get(SettingRecord, "mineru_api_key") is None:
            session.add(SettingRecord(key="mineru_api_key", value=""))
        if session.scalar(select(ModelRecord.id).limit(1)) is None:
            session.add(ModelRecord(id="model_default_gemini", name="gemini-3.5-flash", api_key="", base_url="", is_primary=True))
    migrate_legacy_json()

def migrate_legacy_json() -> None:
    if not LEGACY_DB_PATH.exists(): return
    with SessionLocal.begin() as session:
        if session.scalar(select(PaperRecord.id).limit(1)) is not None: return
        try: legacy = json.loads(LEGACY_DB_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError): return
        config = legacy.get("config", {})
        setting = session.get(SettingRecord, "mineru_api_key")
        setting.value = config.get("mineruApiKey", "")
        legacy_models = config.get("models", [])
        if legacy_models:
            session.query(ModelRecord).delete()
            session.add_all([ModelRecord(id=item.get("id", "model_legacy"), name=item.get("name", "unnamed-model"), api_key=item.get("apiKey", ""), base_url=item.get("baseUrl", ""), is_primary=bool(item.get("isPrimary"))) for item in legacy_models])
        for paper in legacy.get("papers", []):
            record = PaperRecord(id=paper["id"], title=paper.get("title", "Untitled Paper"), url=paper.get("url", ""), is_decoded=bool(paper.get("isDecoded")), decode_status=paper.get("decodeStatus", "pending"), decode_error=paper.get("decodeError"), imported_at=paper.get("importedAt", ""))
            record.blocks = [MarkdownBlockRecord(id=block["id"], block_index=block.get("index", 0), content=block.get("content", ""), page_index=block.get("pageIndex"), bbox=block.get("bbox")) for block in paper.get("mdBlocks", [])]
            session.add(record)
        session.add_all([ChatMessageRecord(id=item["id"], paper_id=item["paperId"], role=item["role"], content=item["content"], created_at=item["createdAt"]) for item in legacy.get("chatMessages", [])])
        session.add_all([RemarkRecord(id=item["id"], paper_id=item["paperId"], block_id=item["blockId"], comment=item["comment"], color=item.get("color", "#fef08a"), created_at=item["createdAt"]) for item in legacy.get("highlightRemarks", [])])
