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
    files: dict[str, bytes]
    markdown_path: str
    pdf_path: str | None
    backend: str | None = None
    version: str | None = None

class MinerUClient:
    def __init__(self, token: str | None = None):
        self.token = token
        self.base_url = os.getenv("MINERU_API_BASE_URL", "https://mineru.net/api/v4").rstrip("/")

    async def parse_url(self, source_url: str) -> MinerUResult:
        token = self.token or os.getenv("MINERU_API_TOKEN", "").strip()
        if not token: raise MinerUError("MINERU_API_TOKEN is not configured.")
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            try:
                response = await client.post(f"{self.base_url}/extract/task", headers={**headers, "Content-Type": "application/json"}, json={"url": source_url, "model_version": "vlm"})
                response.raise_for_status()
            except httpx.HTTPStatusError as err:
                if err.response.status_code == 401:
                    raise MinerUError("MinerU Token 鉴权失败 (401 Unauthorized)，当前 Token 无效或已被撤销。请前往 https://mineru.net/apiManage/token 重新申请 Token。")
                raise MinerUError(f"MinerU API 请求失败 ({err.response.status_code}): {err.response.text}")
            body = response.json()
            if body.get("code") != 0: raise MinerUError(body.get("msg", "Unable to create MinerU task."))
            zip_url = await self._wait_for_result(client, headers, body["data"]["task_id"])
            try:
                archive = await client.get(zip_url)
                archive.raise_for_status()
            except httpx.HTTPStatusError as err:
                raise MinerUError(f"下载 MinerU 解析结果包失败 ({err.response.status_code})")
        return self.extract_archive(archive.content)

    async def _wait_for_result(self, client, headers, task_id):
        for _ in range(120):
            await asyncio.sleep(5)
            response = await client.get(f"{self.base_url}/extract/task/{task_id}", headers=headers); response.raise_for_status()
            data = response.json()["data"]
            if data.get("state") == "done" and data.get("full_zip_url"): return data["full_zip_url"]
            if data.get("state") == "failed": raise MinerUError(data.get("err_msg", "MinerU parsing failed."))
        raise MinerUError("MinerU parsing timed out after 10 minutes.")

    @staticmethod
    def extract_archive(payload: bytes) -> MinerUResult:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            names = [name for name in archive.namelist() if not name.endswith("/")]
            safe = [name for name in names if not PurePosixPath(name).is_absolute() and ".." not in PurePosixPath(name).parts]
            markdown = sorted((name for name in safe if name.lower().endswith(".md")), key=lambda n: ("full.md" not in n.lower(), len(n)))
            pdf = [name for name in safe if name.lower().endswith(".pdf") and not PurePosixPath(name).stem.lower().endswith(("_layout", "_span"))]
            if not markdown: raise MinerUError("MinerU ZIP does not contain a Markdown file.")
            return MinerUResult({name: archive.read(name) for name in safe}, markdown[0], pdf[0] if pdf else None)