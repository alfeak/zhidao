from sqlalchemy import select
from .database import SessionLocal
from .orm_models import SettingRecord, ModelRecord, PaperRecord, MarkdownBlockRecord, ChatMessageRecord, RemarkRecord

MASK = "••••••••••••••••"

def block_dict(block):
    result = {"id": block.id, "index": block.block_index, "content": block.content}
    if block.page_index is not None: result["pageIndex"] = block.page_index
    if block.bbox: result["bbox"] = block.bbox
    return result

def paper_dict(paper):
    result = {"id": paper.id, "title": paper.title, "url": paper.url, "isDecoded": paper.is_decoded, "decodeStatus": paper.decode_status, "mdBlocks": [block_dict(block) for block in paper.blocks], "importedAt": paper.imported_at}
    if paper.decode_error: result["decodeError"] = paper.decode_error
    return result

class PaperRepository:
    def list(self):
        with SessionLocal() as session:
            return [paper_dict(item) for item in session.scalars(select(PaperRecord).order_by(PaperRecord.imported_at.desc())).unique()]
    def get(self, paper_id):
        with SessionLocal() as session:
            paper = session.get(PaperRecord, paper_id)
            return paper_dict(paper) if paper else None
    def create(self, paper):
        with SessionLocal.begin() as session:
            session.add(PaperRecord(id=paper["id"], title=paper["title"], url=paper["url"], decode_status="pending", imported_at=paper["importedAt"]))
        return self.get(paper["id"])
    def set_status(self, paper_id, status, error=None):
        with SessionLocal.begin() as session:
            paper = session.get(PaperRecord, paper_id)
            if paper: paper.decode_status, paper.decode_error = status, error
    def save_decoding(self, paper_id, title, blocks):
        with SessionLocal.begin() as session:
            paper = session.get(PaperRecord, paper_id)
            if not paper: return
            paper.title, paper.is_decoded, paper.decode_status, paper.decode_error = title, True, "done", None
            paper.blocks.clear()
            paper.blocks.extend(MarkdownBlockRecord(id=f"block_{paper_id}_{index}", block_index=block.get("index", index), content=block.get("content", ""), page_index=block.get("pageIndex", 1), bbox=block.get("bbox", f"Page {block.get('pageIndex', 1)}")) for index, block in enumerate(blocks))
    def delete(self, paper_id):
        with SessionLocal.begin() as session:
            paper = session.get(PaperRecord, paper_id)
            if not paper: return False
            session.delete(paper); return True

class ConfigRepository:
    def get(self, masked=True):
        with SessionLocal() as session:
            mineru = session.get(SettingRecord, "mineru_api_key").value
            records = list(session.scalars(select(ModelRecord).order_by(ModelRecord.is_primary.desc(), ModelRecord.id)))
            models = [{"id": item.id, "name": item.name, "apiKey": MASK if masked and item.api_key else item.api_key, "baseUrl": item.base_url, "isPrimary": item.is_primary} for item in records]
        return {"mineruApiKey": MASK if masked and mineru else mineru, "models": models}
    def update(self, payload):
        previous = self.get(masked=False)
        mineru = payload.get("mineruApiKey", previous["mineruApiKey"])
        if isinstance(mineru, str) and mineru.startswith("•••"): mineru = previous["mineruApiKey"]
        models, old = payload.get("models", previous["models"]), {item["id"]: item for item in previous["models"]}
        with SessionLocal.begin() as session:
            session.get(SettingRecord, "mineru_api_key").value = mineru or ""
            session.query(ModelRecord).delete()
            for index, model in enumerate(models):
                key = model.get("apiKey", "")
                if isinstance(key, str) and key.startswith("•••"): key = old.get(model.get("id"), {}).get("apiKey", "")
                session.add(ModelRecord(id=model.get("id") or f"model_{index}", name=model.get("name") or "unnamed-model", api_key=key, base_url=model.get("baseUrl") or "", is_primary=bool(model.get("isPrimary"))))
        return self.get(masked=True)

class CollaborationRepository:
    def messages(self, paper_id):
        with SessionLocal() as session:
            return [{"id": item.id, "paperId": item.paper_id, "role": item.role, "content": item.content, "createdAt": item.created_at} for item in session.scalars(select(ChatMessageRecord).where(ChatMessageRecord.paper_id == paper_id).order_by(ChatMessageRecord.created_at))]
    def add_message(self, message):
        with SessionLocal.begin() as session: session.add(ChatMessageRecord(id=message["id"], paper_id=message["paperId"], role=message["role"], content=message["content"], created_at=message["createdAt"]))
    def clear_messages(self, paper_id):
        with SessionLocal.begin() as session:
            for item in session.scalars(select(ChatMessageRecord).where(ChatMessageRecord.paper_id == paper_id)): session.delete(item)
    def remarks(self, paper_id):
        with SessionLocal() as session:
            return [{"id": item.id, "paperId": item.paper_id, "blockId": item.block_id, "comment": item.comment, "color": item.color, "createdAt": item.created_at} for item in session.scalars(select(RemarkRecord).where(RemarkRecord.paper_id == paper_id).order_by(RemarkRecord.created_at))]
    def add_remark(self, remark):
        with SessionLocal.begin() as session: session.add(RemarkRecord(id=remark["id"], paper_id=remark["paperId"], block_id=remark["blockId"], comment=remark["comment"], color=remark["color"], created_at=remark["createdAt"]))
        return remark
    def delete_remark(self, remark_id):
        with SessionLocal.begin() as session:
            item = session.get(RemarkRecord, remark_id)
            if item: session.delete(item)
