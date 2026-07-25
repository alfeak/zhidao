from fastapi import APIRouter, BackgroundTasks, Body, HTTPException
from .application.services import PaperService
from .domain.errors import NotFoundError, ValidationError
from fastapi.responses import FileResponse
from .infrastructure.repositories import ConfigRepository

router = APIRouter(prefix="/api")
papers = PaperService()
config = ConfigRepository()

def require(value, name):
    if not value: raise ValidationError(f"{name} is required")

@router.get("/config")
def get_config(): return config.get(masked=True)

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
    pdf_path = papers.cache_dir / f"{paper_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Parsed PDF is not available yet.")
    return FileResponse(pdf_path, media_type="application/pdf")
@router.get("/papers/{paper_id}/assets/{asset_path:path}")
def get_paper_asset(paper_id: str, asset_path: str):
    root = (papers.asset_cache_dir / paper_id).resolve()
    candidate = (root / asset_path).resolve()
    if root not in candidate.parents or not candidate.is_file():
        raise HTTPException(status_code=404, detail="Paper asset was not found.")
    return FileResponse(candidate)
@router.get("/papers")
def list_papers(): return papers.list_papers()

@router.post("/papers/import")
async def import_paper(payload: dict, background_tasks: BackgroundTasks):
    paper = await papers.import_paper(payload.get("url"), payload.get("title"))
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
    require(payload.get("paperId"), "paperId"); require(payload.get("blockId"), "blockId"); require(payload.get("comment"), "comment")
    remark = {"id": papers.identifier("remark"), "paperId": payload["paperId"], "blockId": payload["blockId"], "comment": payload["comment"], "color": payload.get("color") or "#fef08a", "createdAt": papers.now()}
    return papers.collaboration.add_remark(remark)

@router.delete("/remarks/{remark_id}")
def delete_remark(remark_id: str):
    papers.collaboration.delete_remark(remark_id); return {"success": True}
