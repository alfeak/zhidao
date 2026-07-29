import os
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Query, Request, Response, Cookie
from .application.services import PaperService
from .application.auth_service import AuthService
from .domain.errors import NotFoundError, ValidationError
from fastapi.responses import StreamingResponse
from .infrastructure.repositories import ConfigRepository
from .domain.translation_languages import TRANSLATION_LANGUAGES

router = APIRouter(prefix="/api")
papers = PaperService()
config = ConfigRepository()
auth_service = AuthService()

def extract_session_id(request: Request, cookie_session: str | None = None) -> str | None:
    if cookie_session:
        return cookie_session
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None

def get_current_user_from_req(request: Request, zhidao_session: str | None = None) -> dict | None:
    session_id = extract_session_id(request, zhidao_session)
    return auth_service.get_user_by_session(session_id) if session_id else None

@router.get("/auth/config")
def get_auth_config():
    return {"clientId": auth_service.get_google_client_id()}

@router.post("/auth/google")
async def google_login(response: Response, payload: dict = Body(...)):
    credential = payload.get("credential")
    if not credential:
        raise ValidationError("Google credential token is required")
    try:
        result = await auth_service.authenticate_google_user(credential)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    response.set_cookie(
        key="zhidao_session",
        value=result["sessionId"],
        httponly=True,
        max_age=30 * 86400,
        samesite="lax",
        path="/",
    )
    return {"success": True, "user": result["user"], "sessionId": result["sessionId"]}

@router.get("/auth/me")
def get_current_user(request: Request, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    return {"user": user}

@router.post("/auth/logout")
def logout(request: Request, response: Response, zhidao_session: str | None = Cookie(None)):
    session_id = extract_session_id(request, zhidao_session)
    if session_id:
        auth_service.logout_session(session_id)
    response.delete_cookie(key="zhidao_session", path="/")
    return {"success": True}

def require(value, name):
    if not value: raise ValidationError(f"{name} is required")

@router.get("/config")
def get_config(request: Request, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    return config.get_for_user(user_id, masked=True)

@router.get("/translation-languages")
def get_translation_languages(): return {"languages": TRANSLATION_LANGUAGES}

@router.get("/search")
def search_papers(q: str = Query(..., min_length=1), limit: int = Query(30, ge=1, le=100)):
    return {"results": papers.search(q, limit)}

@router.post("/config")
def update_config(request: Request, payload: dict = Body(...), zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    return {"success": True, "config": config.update_for_user(user_id, payload)}

@router.post("/config/test-model")
async def test_model(request: Request, payload: dict = Body(...), zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    user_cfg = config.get_for_user(user_id, masked=False)
    
    api_key = payload.get("apiKey") or payload.get("llmApiKey")
    if not api_key or str(api_key).startswith("•••"):
        api_key = user_cfg.get("llmApiKey") or os.getenv("DEEPSEEK_API_KEY", "").strip()
    model_name = payload.get("name") or payload.get("model") or payload.get("llmModel") or user_cfg.get("llmModel") or "deepseek-v4-pro"
    base_url = payload.get("baseUrl") or payload.get("llmBaseUrl") or user_cfg.get("llmBaseUrl") or "https://api.deepseek.com"

    if not api_key:
        raise ValidationError("API Key is required to perform testing.")

    model = {"id": "test", "name": model_name, "apiKey": api_key, "baseUrl": base_url, "isPrimary": True}
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

@router.get("/papers/{paper_id}/layout-boxes")
def get_layout_boxes(paper_id: str):
    papers.paper(paper_id)
    return {"boxes": papers.layout_boxes(paper_id)}

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
        return {"content": markdown, "blocks": papers.translated_markdown_blocks(paper_id, target_language), "targetLanguage": target_language, "isTranslation": True}
    markdown, _ = papers.markdown(paper_id)
    return {"content": markdown, "blocks": papers.markdown_blocks(paper_id), "isTranslation": False}

@router.post("/papers/{paper_id}/translations", status_code=202)
async def translate_markdown(paper_id: str, payload: dict = Body(...)):
    job = await papers.enqueue_translation(paper_id, payload.get("targetLanguage"))
    return {"success": True, "translationJob": job}

@router.get("/papers/{paper_id}")
def get_paper(paper_id: str): return papers.paper(paper_id)
@router.get("/papers")
def list_papers(): return papers.list_papers()

@router.post("/papers/import")
async def import_paper(request: Request, payload: dict, background_tasks: BackgroundTasks, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    paper = await papers.import_paper(payload.get("url"), payload.get("title"))
    if not paper.get("isDecoded"):
        background_tasks.add_task(papers.decode, paper["id"], user_id)
    return {"success": True, "paper": paper}

@router.delete("/papers/{paper_id}")
def delete_paper(paper_id: str):
    papers.delete_paper(paper_id); return {"success": True}

@router.post("/papers/{paper_id}/decode")
def decode_paper(request: Request, paper_id: str, background_tasks: BackgroundTasks, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    paper = papers.start_decoding(paper_id)
    background_tasks.add_task(papers.decode, paper_id, user_id)
    return {"success": True, "paper": paper}

@router.get("/papers/{paper_id}/chat")
def get_chat(request: Request, paper_id: str, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    return papers.collaboration.messages(paper_id, user_id=user_id)

@router.post("/papers/{paper_id}/chat/clear")
def clear_chat(request: Request, paper_id: str, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    papers.collaboration.clear_messages(paper_id, user_id=user_id)
    return {"success": True}

@router.get("/papers/{paper_id}/remarks")
def get_remarks(request: Request, paper_id: str, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    return papers.collaboration.remarks(paper_id, user_id=user_id)

@router.post("/remarks")
def add_remark(request: Request, payload: dict, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    require(payload.get("paperId"), "paperId")
    require(payload.get("comment"), "comment")
    block_index = payload.get("blockIndex")
    if isinstance(block_index, bool) or not isinstance(block_index, int) or block_index < 0:
        raise ValidationError("blockIndex must be a non-negative integer")
    if block_index not in papers.markdown_block_indices(payload["paperId"]):
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
    saved = papers.collaboration.add_remark(remark, user_id=user_id)
    if not saved:
        raise NotFoundError("Paper not found")
    return saved

@router.delete("/remarks/{remark_id}")
def delete_remark(request: Request, remark_id: str, zhidao_session: str | None = Cookie(None)):
    user = get_current_user_from_req(request, zhidao_session)
    user_id = user["id"] if user else None
    if not papers.collaboration.delete_remark(remark_id, user_id=user_id):
        raise NotFoundError("Remark not found")
    return {"success": True}
