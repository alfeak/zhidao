from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .api import router, papers
from .domain.errors import NotFoundError, ValidationError
from .infrastructure.database import initialize_database

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    await asyncio.to_thread(papers.rebuild_search_indexes)
    await papers.recover_translation_jobs()
    yield

app = FastAPI(title="Zhidao API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(NotFoundError)
async def not_found(_: Request, error: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(error), "error": str(error), "message": str(error)})

@app.exception_handler(ValidationError)
async def invalid(_: Request, error: ValidationError):
    return JSONResponse(status_code=400, content={"detail": str(error), "error": str(error), "message": str(error)})

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(router)
