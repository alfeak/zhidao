import asyncio
from dataclasses import dataclass
from io import BytesIO
import os
from pathlib import PurePosixPath
import zipfile
import httpx

class MinerUError(Exception):
    pass

@dataclass(frozen=True)
class MinerUResult:
    markdown: str
    pdf_bytes: bytes

class MinerUClient:
    def __init__(self, token: str | None = None):
        self.token = token
        self.base_url = os.getenv("MINERU_API_BASE_URL", "https://mineru.net/api/v4").rstrip("/")

    async def parse_url(self, source_url: str) -> MinerUResult:
        token = self.token or os.getenv("MINERU_API_TOKEN", "").strip()
        if not token:
            raise MinerUError("MINERU_API_TOKEN is not configured.")
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            response = await client.post(f"{self.base_url}/extract/task", headers={**headers, "Content-Type": "application/json"}, json={"url": source_url, "model_version": "vlm"})
            response.raise_for_status()
            body = response.json()
            if body.get("code") != 0: raise MinerUError(body.get("msg", "Unable to create MinerU task."))
            task_id = body["data"]["task_id"]
            zip_url = await self._wait_for_result(client, headers, task_id)
            archive = await client.get(zip_url)
            archive.raise_for_status()
        return self.extract_archive(archive.content)

    async def _wait_for_result(self, client: httpx.AsyncClient, headers: dict, task_id: str) -> str:
        for _ in range(120):
            await asyncio.sleep(5)
            response = await client.get(f"{self.base_url}/extract/task/{task_id}", headers=headers)
            response.raise_for_status()
            body = response.json()
            if body.get("code") != 0: raise MinerUError(body.get("msg", "Unable to query MinerU task."))
            data = body["data"]
            if data.get("state") == "done" and data.get("full_zip_url"): return data["full_zip_url"]
            if data.get("state") == "failed": raise MinerUError(data.get("err_msg", "MinerU parsing failed."))
        raise MinerUError("MinerU parsing timed out after 10 minutes.")

    @staticmethod
    def extract_archive(payload: bytes) -> MinerUResult:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            names = [name for name in archive.namelist() if not name.endswith("/")]
            markdown_names = sorted((name for name in names if name.lower().endswith(".md")), key=lambda name: ("full.md" not in name.lower(), len(name)))
            pdf_names = [name for name in names if name.lower().endswith(".pdf") and not PurePosixPath(name).stem.lower().endswith(("_layout", "_span"))]
            if not markdown_names: raise MinerUError("MinerU ZIP does not contain a Markdown file.")
            if not pdf_names: raise MinerUError("MinerU ZIP does not contain the parsed PDF file.")
            return MinerUResult(markdown=archive.read(markdown_names[0]).decode("utf-8"), pdf_bytes=archive.read(pdf_names[0]))