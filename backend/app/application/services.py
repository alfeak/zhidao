from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import json
import os
import re
from urllib.parse import unquote
import httpx

from ..infrastructure.repositories import PaperRepository, ConfigRepository, CollaborationRepository

class NotFoundError(Exception): pass
class ValidationError(Exception): pass

class LlmGateway:
    async def generate(self, config, prompt, system_instruction=None, response_json=False):
        models = config["models"]
        model = next((item for item in models if item["isPrimary"]), models[0] if models else None)
        if not model: raise ValidationError("No primary LLM model is configured.")
        key = model["apiKey"] or (os.getenv("GEMINI_API_KEY", "") if not model["baseUrl"] and "gemini" in model["name"].lower() else "")
        if not key: raise ValidationError(f"API key is missing for model: {model['name']}")
        if not model["baseUrl"] and "gemini" in model["name"].lower():
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            if system_instruction: payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
            if response_json: payload["generationConfig"] = {"responseMimeType": "application/json"}
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model['name']}:generateContent?key={key}"
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(url, json=payload); response.raise_for_status()
            return response.json()["candidates"][0]["content"]["parts"][0]["text"]
        base = (model["baseUrl"] or "https://api.openai.com/v1").rstrip("/")
        messages = ([{"role": "system", "content": system_instruction}] if system_instruction else []) + [{"role": "user", "content": prompt}]
        payload = {"model": model["name"], "messages": messages}
        if response_json: payload["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(f"{base}/chat/completions", headers={"Authorization": f"Bearer {key}"}, json=payload); response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

class PaperService:
    def __init__(self):
        self.papers, self.config, self.collaboration = PaperRepository(), ConfigRepository(), CollaborationRepository()
        self.llm = LlmGateway()
        self.cache_dir = Path(__file__).resolve().parents[2] / "data" / "pdfs"

    @staticmethod
    def now(): return datetime.now(timezone.utc).isoformat()
    @staticmethod
    def identifier(prefix): return f"{prefix}_{uuid4().hex}"

    def list_papers(self): return self.papers.list()
    def import_paper(self, url, title=None):
        if not url or not url.strip(): raise ValidationError("Paper URL is required")
        name = title or url.rstrip("/").split("/")[-1].removesuffix(".pdf") or "Untitled Paper"
        try: name = re.sub(r"\s+", " ", unquote(name)).strip()
        except Exception: pass
        return self.papers.create({"id": self.identifier("paper"), "title": name, "url": url.strip(), "importedAt": self.now()})
    def delete_paper(self, paper_id):
        if not self.papers.delete(paper_id): raise NotFoundError("Paper not found")
        cache = self.cache_dir / f"{paper_id}.pdf"
        if cache.exists(): cache.unlink()
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
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            cache = self.cache_dir / f"{paper_id}.pdf"
            if not cache.exists():
                async with httpx.AsyncClient(timeout=90, follow_redirects=True) as client:
                    response = await client.get(paper["url"]); response.raise_for_status(); cache.write_bytes(response.content)
            blocks, title = await self._extract(paper, cache)
            self.papers.save_decoding(paper_id, title, blocks)
        except Exception as error:
            self.papers.set_status(paper_id, "failed", str(error))
    async def _extract(self, paper, cache):
        config = self.config.get(masked=False)
        try:
            models = config["models"]; primary = next((m for m in models if m["isPrimary"]), models[0] if models else None)
            if primary and (primary["apiKey"] or os.getenv("GEMINI_API_KEY")) and not primary["baseUrl"] and "gemini" in primary["name"].lower():
                encoded = __import__("base64").b64encode(cache.read_bytes()).decode()
                prompt = "Extract this PDF into JSON only: {title: string, blocks: [{index: number, pageIndex: number, content: string, bbox: string}]}. Preserve headings, equations, and logical sections."
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{primary['name']}:generateContent?key={primary['apiKey'] or os.getenv('GEMINI_API_KEY')}"
                payload = {"contents": [{"parts": [{"inlineData": {"mimeType": "application/pdf", "data": encoded}}, {"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}}
                async with httpx.AsyncClient(timeout=180) as client:
                    response = await client.post(url, json=payload); response.raise_for_status()
                text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                decoded = json.loads(text)
                if decoded.get("blocks"): return decoded["blocks"], decoded.get("title") or paper["title"]
        except Exception:
            pass
        return ([{"index": 0, "pageIndex": 1, "bbox": "Document", "content": "## PDF 已导入\n\n该文档已缓存，等待配置可用的解析模型后可重新解码。"}], paper["title"])
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
