from datetime import datetime, timezone
from pathlib import Path
from pathlib import PurePosixPath
import shutil
from uuid import uuid4
import re

from ..domain.errors import NotFoundError, ValidationError
from ..infrastructure.mineru_client import MinerUClient
from ..infrastructure.openai_gateway import OpenAICompatibleGateway
from ..infrastructure.repositories import PaperRepository, ConfigRepository, CollaborationRepository
from .paper_title_resolver import PaperTitleResolver
class PaperService:
    def __init__(self):
        self.papers, self.config, self.collaboration = PaperRepository(), ConfigRepository(), CollaborationRepository()
        self.llm = OpenAICompatibleGateway()
        self.title_resolver = PaperTitleResolver()
        self.mineru = MinerUClient()
        self.cache_dir = Path(__file__).resolve().parents[2] / "data" / "pdfs"
        self.asset_cache_dir = Path(__file__).resolve().parents[2] / "data" / "assets"

    @staticmethod
    def now(): return datetime.now(timezone.utc).isoformat()
    @staticmethod
    def identifier(prefix): return f"{prefix}_{uuid4().hex}"

    def list_papers(self): return self.papers.list()
    async def import_paper(self, url, title=None):
        if not url or not url.strip(): raise ValidationError("Paper URL is required")
        resolved = await self.title_resolver.resolve(url, title)
        return self.papers.create({"id": self.identifier("paper"), "title": resolved.title, "url": resolved.url, "importedAt": self.now()})
    def delete_paper(self, paper_id):
        if not self.papers.delete(paper_id): raise NotFoundError("Paper not found")
        cache = self.cache_dir / f"{paper_id}.pdf"
        if cache.exists(): cache.unlink()
        asset_dir = self.asset_cache_dir / paper_id
        if asset_dir.exists(): shutil.rmtree(asset_dir)
    def start_decoding(self, paper_id):
        paper = self.papers.get(paper_id)
        if not paper: raise NotFoundError("Paper not found")
        self.papers.set_status(paper_id, "pending")
        return self.papers.get(paper_id)
    async def decode(self, paper_id):
        paper = self.papers.get(paper_id)
        if not paper: return
        self.papers.set_status(paper_id, "processing")
        try:
            result = await self.mineru.parse_url(paper["url"])
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            (self.cache_dir / f"{paper_id}.pdf").write_bytes(result.pdf_bytes)
            asset_dir = self.asset_cache_dir / paper_id
            for asset_path, asset_bytes in result.assets.items():
                destination = asset_dir.joinpath(*PurePosixPath(asset_path).parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(asset_bytes)
            self.papers.save_decoding(paper_id, paper["title"], self._markdown_blocks(result.markdown))
        except Exception as error:
            self.papers.set_status(paper_id, "failed", str(error))

    @staticmethod
    def _markdown_blocks(markdown: str):
        sections = [section.strip() for section in re.split(r"(?=^#{1,6}\s)", markdown, flags=re.MULTILINE) if section.strip()]
        if not sections: raise ValidationError("MinerU returned an empty Markdown document.")
        return [{"index": index, "pageIndex": 1, "bbox": "MinerU Markdown", "content": section} for index, section in enumerate(sections)]
    async def chat(self, paper_id, message):
        paper = self.papers.get(paper_id)
        if not paper: raise NotFoundError("Paper not found")
        if not message or not message.strip(): raise ValidationError("Message content is required")
        user = {"id": self.identifier("msg"), "paperId": paper_id, "role": "user", "content": message.strip(), "createdAt": self.now()}
        self.collaboration.add_message(user)
        blocks = "\n\n".join(f"[Block {block['index']}, Page {block.get('pageIndex', 1)}]\n{block['content']}" for block in paper["mdBlocks"])
        history = "\n".join(f"{item['role']}: {item['content']}" for item in self.collaboration.messages(paper_id)[-16:-1])
        prompt = f"You are Zhidao, a research reading assistant.\nPaper: {paper['title']}\n\n{blocks or 'PDF is not decoded.'}\n\nHistory:\n{history}\n\nUser: {message}\nAssistant:"
        reply = await self.llm.generate(self.config.get(masked=False), prompt)
        model = {"id": self.identifier("msg"), "paperId": paper_id, "role": "model", "content": reply, "createdAt": self.now()}
        self.collaboration.add_message(model)
        return {"userMessage": user, "modelMessage": model}
    async def action(self, paper_id, payload):
        paper = self.papers.get(paper_id)
        if not paper: raise NotFoundError("Paper not found")
        action = payload.get("action"); text = "\n\n".join(block["content"] for block in paper["mdBlocks"])
        if action == "translate_full": prompt = f"Translate this paper into {payload.get('targetLanguage') or 'Chinese'}, preserving Markdown.\n\n{text}"
        elif action == "search_full": prompt = f"Search this paper for: {payload.get('query', '')}. Cite matching blocks and summarize.\n\n{text}"
        elif action == "parse_block":
            block = next((item for item in paper["mdBlocks"] if item["id"] == payload.get("blockId")), None)
            if not block: raise NotFoundError("Block not found")
            prompt = f"Deeply explain this academic passage, including formulas and methodology.\n\n{block['content']}"
        elif action == "parse_full": prompt = f"Provide executive summary, methodology, results, contributions, limitations, and future directions.\n\n{text}"
        else: raise ValidationError("Unknown action")
        return {"result": await self.llm.generate(self.config.get(masked=False), prompt, "You are an expert research assistant.")}