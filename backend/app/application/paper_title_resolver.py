from dataclasses import dataclass
from pathlib import PurePosixPath
from urllib.parse import unquote, urlparse
import re
import xml.etree.ElementTree as ET
import httpx

@dataclass(frozen=True)
class ResolvedPaperImport:
    url: str
    title: str

class PaperTitleResolver:
    """Resolves arXiv metadata first, then safely falls back to a URL filename."""
    _arxiv_abs = re.compile(r"arxiv\.org/abs/([a-zA-Z0-9.\-]+)", re.IGNORECASE)
    _arxiv_pdf = re.compile(r"arxiv\.org/pdf/([a-zA-Z0-9.\-]+)", re.IGNORECASE)
    _known_extensions = {".pdf", ".html", ".doc", ".docx", ".ppt", ".pptx"}

    async def resolve(self, url: str, supplied_title: str | None = None) -> ResolvedPaperImport:
        normalized_url = url.strip()
        manual_title = self._clean(supplied_title or "")
        arxiv_id = self._arxiv_id(normalized_url)
        if arxiv_id:
            normalized_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
            if not manual_title:
                manual_title = await self._fetch_arxiv_title(arxiv_id)
            return ResolvedPaperImport(normalized_url, manual_title or f"arXiv:{arxiv_id}")
        return ResolvedPaperImport(normalized_url, manual_title or self._filename_title(normalized_url) or "Imported Document")

    def _arxiv_id(self, url: str) -> str | None:
        match = self._arxiv_abs.search(url) or self._arxiv_pdf.search(url)
        if not match:
            return None
        aid = match.group(1)
        if aid.lower().endswith(".pdf"):
            aid = aid[:-4]
        return aid

    async def _fetch_arxiv_title(self, arxiv_id: str) -> str | None:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=headers) as client:
            try:
                response = await client.get("https://export.arxiv.org/api/query", params={"id_list": arxiv_id})
                if response.status_code == 200:
                    root = ET.fromstring(response.text)
                    title = root.findtext("{http://www.w3.org/2005/Atom}entry/{http://www.w3.org/2005/Atom}title")
                    cleaned = self._clean(title or "")
                    if cleaned:
                        return cleaned
            except Exception:
                pass

            try:
                response = await client.get(f"https://arxiv.org/abs/{arxiv_id}")
                if response.status_code == 200:
                    m = re.search(r"Title:</span>\s*(.*?)\s*</h1>", response.text, re.DOTALL)
                    if m:
                        cleaned = self._clean(m.group(1).replace("\n", " "))
                        if cleaned:
                            return cleaned
            except Exception:
                pass
        return None

    def _filename_title(self, url: str) -> str | None:
        filename = unquote(PurePosixPath(urlparse(url).path).name)
        suffix = PurePosixPath(filename).suffix.lower()
        if not filename or suffix not in self._known_extensions:
            return None
        return self._clean(filename[:-len(suffix)])

    @staticmethod
    def _clean(value: str) -> str:
        return " ".join(value.strip().split())