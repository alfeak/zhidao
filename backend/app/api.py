from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Query
from .application.services import PaperService
from .domain.errors import NotFoundError, ValidationError
from fastapi.responses import StreamingResponse
from .infrastructure.repositories import ConfigRepository
from .domain.translation_languages import TRANSLATION_LANGUAGES

router = APIRouter(prefix="/api")
papers = PaperService()
config = ConfigRepository()

def require(value, name):
    if not value: raise ValidationError(f"{name} is required")

@router.get("/config")
def get_config(): return config.get(masked=True)

@router.get("/translation-languages")
def get_translation_languages(): return {"languages": TRANSLATION_LANGUAGES}

@router.post("/config")
def update_config(payload: dict = Body(...)):
    return {"success": True, "config": config.update(payload)}

@router.post("/config/test-model")
async def test_model(payload: dict = Body(...)):
    model_id = payload.get("modelId")
    stored = config.get(masked=False)["models"]
    if model_id:
        model = next((item for item in stored if item["id"] == model_id), None)
        if not model: raise NotFoundError("Model not found for testing.")
    else:
        model = {"id": "test", "name": payload.get("name", ""), "apiKey": payload.get("apiKey", ""), "baseUrl": payload.get("baseUrl", ""), "isPrimary": True}
    if not model["apiKey"] or str(model["apiKey"]).startswith("•••"): raise ValidationError("API Key is required to perform testing.")
    result = await papers.llm.generate({"models": [model]}, "Reply with a short successful connection message.")
    return {"success": True, "message": result}

@router.get("/papers/{paper_id}/file")
def get_parsed_pdf(paper_id: str):
    from .infrastructure.database import SessionLocal
    from .infrastructure.orm_models import DocumentArtifactRecord
    from sqlalchemy import select
    with SessionLocal() as session:
        artifact = session.scalar(select(DocumentArtifactRecord).where(DocumentArtifactRecord.document_id == paper_id, DocumentArtifactRecord.kind == "pdf"))
    if not artifact: raise HTTPException(status_code=404, detail="Parsed PDF is not available yet.")
    from .infrastructure.object_store import R2ObjectStore
    body, media_type = R2ObjectStore().stream(artifact.object_key)
    return StreamingResponse(body.iter_chunks(), media_type=media_type)

@router.get("/papers/{paper_id}/assets/{asset_path:path}")
def get_paper_asset(paper_id: str, asset_path: str):
    artifact = papers.artifact(paper_id, asset_path)
    from .infrastructure.object_store import R2ObjectStore
    body, media_type = R2ObjectStore().stream(artifact.object_key)
    return StreamingResponse(body.iter_chunks(), media_type=media_type)

@router.get("/papers/{paper_id}/markdown")
def get_markdown(paper_id: str, target_language: str | None = Query(None, alias="targetLanguage")):
    if target_language:
        markdown, _ = papers.translated_markdown(paper_id, target_language)
        return {"content": markdown, "targetLanguage": target_language, "isTranslation": True}
    markdown, _ = papers.markdown(paper_id)
    return {"content": markdown, "isTranslation": False}

@router.post("/papers/{paper_id}/translations", status_code=202)
async def translate_markdown(paper_id: str, payload: dict = Body(...)):
    job = await papers.enqueue_translation(paper_id, payload.get("targetLanguage"))
    return {"success": True, "translationJob": job}

@router.get("/papers/{paper_id}")
def get_paper(paper_id: str): return papers.paper(paper_id)
@router.get("/papers")
def list_papers(): return papers.list_papers()

@router.post("/papers/import")
async def import_paper(payload: dict, background_tasks: BackgroundTasks):
    paper = await papers.import_paper(payload.get("url"), payload.get("title"))
    if not paper.get("isDecoded"):
        background_tasks.add_task(papers.decode, paper["id"])
    return {"success": True, "paper": paper}

@router.delete("/papers/{paper_id}")
def delete_paper(paper_id: str):
    papers.delete_paper(paper_id); return {"success": True}

@router.post("/papers/{paper_id}/decode")
def decode_paper(paper_id: str, background_tasks: BackgroundTasks):
    paper = papers.start_decoding(paper_id)
    background_tasks.add_task(papers.decode, paper_id)
    return {"success": True, "paper": paper}

@router.get("/papers/{paper_id}/chat")
def get_chat(paper_id: str): return papers.collaboration.messages(paper_id)

@router.post("/papers/{paper_id}/chat/clear")
def clear_chat(paper_id: str):
    papers.collaboration.clear_messages(paper_id); return {"success": True}

@router.post("/papers/{paper_id}/chat")
async def send_chat(paper_id: str, payload: dict): return await papers.chat(paper_id, payload.get("message"))

@router.post("/papers/{paper_id}/action")
async def paper_action(paper_id: str, payload: dict): return await papers.action(paper_id, payload)

@router.get("/papers/{paper_id}/remarks")
def get_remarks(paper_id: str): return papers.collaboration.remarks(paper_id)

@router.post("/remarks")
def add_remark(payload: dict):
    require(payload.get("paperId"), "paperId")
    require(payload.get("comment"), "comment")
    block_index = payload.get("blockIndex")
    if isinstance(block_index, bool) or not isinstance(block_index, int) or block_index < 0:
        raise ValidationError("blockIndex must be a non-negative integer")
    if block_index >= papers.markdown_block_count(payload["paperId"]):
        raise ValidationError("blockIndex does not refer to a Markdown block in this paper")
    comment = str(payload["comment"]).strip()
    if not comment:
        raise ValidationError("comment is required")
    remark = {
        "id": papers.identifier("remark"),
        "paperId": payload["paperId"],
        "blockIndex": block_index,
        "comment": comment,
        "color": payload.get("color") or "#fef08a",
        "createdAt": papers.now(),
    }
    saved = papers.collaboration.add_remark(remark)
    if not saved:
        raise NotFoundError("Paper not found")
    return saved

@router.delete("/remarks/{remark_id}")
def delete_remark(remark_id: str):
    if not papers.collaboration.delete_remark(remark_id):
        raise NotFoundError("Remark not found")
    return {"success": True}

