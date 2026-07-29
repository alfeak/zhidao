from pathlib import Path
from sqlalchemy import create_engine, delete, inspect, select
from sqlalchemy.orm import sessionmaker
from .orm_models import Base, ModelRecord, SchemaMetadataRecord
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATABASE_PATH = DATA_DIR / "zhidao.db"
engine = create_engine(f"sqlite:///{DATABASE_PATH.as_posix()}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
def initialize_database():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    names = inspect(engine).get_table_names()
    if "schema_metadata" not in names:
        with engine.begin() as conn:
            for name in names: conn.exec_driver_sql(f'DROP TABLE IF EXISTS "{name}"')
    Base.metadata.create_all(engine)
    # FTS5 virtual tables are not managed by SQLAlchemy metadata.
    from .search_index import SearchIndex
    SearchIndex.initialize()
    # create_all does not add columns to an existing SQLite table. Keep this
    # small compatibility migration here because the application bootstraps its
    # schema directly in local and Docker deployments.
    if "translation_language" not in {column["name"] for column in inspect(engine).get_columns("document_artifacts")}:
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE document_artifacts ADD COLUMN translation_language VARCHAR")
    if "block_index" not in {column["name"] for column in inspect(engine).get_columns("remarks")}:
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE remarks ADD COLUMN block_index INTEGER")
    if "user_id" not in {column["name"] for column in inspect(engine).get_columns("remarks")}:
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE remarks ADD COLUMN user_id VARCHAR")
    if "user_id" not in {column["name"] for column in inspect(engine).get_columns("chat_messages")}:
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE chat_messages ADD COLUMN user_id VARCHAR")
    if "user_settings" in inspect(engine).get_table_names() and "configs_json" not in {column["name"] for column in inspect(engine).get_columns("user_settings")}:
        with engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE user_settings ADD COLUMN configs_json TEXT")
    with SessionLocal.begin() as s:
        s.merge(SchemaMetadataRecord(key="schema_version", value="2"))
        if s.scalar(select(ModelRecord.id).limit(1)) is None:
            s.add(ModelRecord(id="model_default_openai", name="gpt-4o-mini", api_key="", base_url="https://api.openai.com/v1", is_primary=True))
