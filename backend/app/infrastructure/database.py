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
    with SessionLocal.begin() as s:
        s.merge(SchemaMetadataRecord(key="schema_version", value="2"))
        if s.scalar(select(ModelRecord.id).limit(1)) is None:
            s.add(ModelRecord(id="model_default_openai", name="gpt-4o-mini", api_key="", base_url="https://api.openai.com/v1", is_primary=True))
