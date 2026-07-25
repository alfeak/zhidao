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
    _arxiv_pdf = re.compile(r"arxiv\.org/pdf/([a-zA-Z0-9.\-]+?)(?:\.pdf)?(?:[?#].*)?$", re.IGNORECASE)
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
        return match.group(1) if match else None

    async def _fetch_arxiv_title(self, arxiv_id: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get("https://export.arxiv.org/api/query", params={"id_list": arxiv_id})
                response.raise_for_status()
            root = ET.fromstring(response.text)
            title = root.findtext("{http://www.w3.org/2005/Atom}entry/{http://www.w3.org/2005/Atom}title")
            return self._clean(title or "") or None
        except (httpx.HTTPError, ET.ParseError):
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