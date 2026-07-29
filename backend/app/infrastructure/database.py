from pathlib import Path
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from .orm_models import Base, SchemaMetadataRecord

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATABASE_PATH = DATA_DIR / "zhidao.db"
engine = create_engine(f"sqlite:///{DATABASE_PATH.as_posix()}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def initialize_database():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    names = inspect(engine).get_table_names()
    # First boot: no schema_metadata means either a brand-new DB or a legacy DB
    # that pre-dates versioned migrations — drop everything and start fresh.
    if "schema_metadata" not in names:
        with engine.begin() as conn:
            for name in names:
                conn.exec_driver_sql(f'DROP TABLE IF EXISTS "{name}"')
    Base.metadata.create_all(engine)
    # FTS5 virtual tables are not managed by SQLAlchemy metadata.
    from .search_index import SearchIndex
    SearchIndex.initialize()
    from sqlalchemy.orm import Session
    with Session(engine) as s, s.begin():
        s.merge(SchemaMetadataRecord(key="schema_version", value="3"))
