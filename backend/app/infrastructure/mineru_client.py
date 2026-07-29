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
    def __init__(self, token: str | None = None, base_url: str | None = None, user_id: str | None = None):
        if user_id and (not token or not base_url):
            from .repositories import UserSettingsRepository
            s = UserSettingsRepository.get_user_settings(user_id)
            if not token: token = s.get("mineruToken")
            if not base_url: base_url = s.get("mineruBaseUrl")
        self.token = token
        self.base_url = (base_url or "https://mineru.net/api/v4").rstrip("/")

    async def parse_url(self, source_url: str) -> MinerUResult:
        token = self.token
        if not token:
            raise MinerUError("未在【设置 -> MinerU解析设置】中添加或指定有效的 MinerU API Token。")

        headers = {"Authorization": f"Bearer {token}"}
        # trust_env=False prevents docker container from picking up invalid host proxy env variables (like 127.0.0.1:7890)
        async with httpx.AsyncClient(timeout=90, follow_redirects=True, trust_env=False) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/extract/task",
                    headers={**headers, "Content-Type": "application/json"},
                    json={"url": source_url, "model_version": "vlm"}
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as err:
                if err.response.status_code == 401:
                    raise MinerUError("MinerU Token 鉴权失败 (401 Unauthorized)，当前 Token 无效或已被撤销。请前往 https://mineru.net/apiManage/token 重新申请 Token。")
                raise MinerUError(f"MinerU API 请求失败 ({err.response.status_code}): {err.response.text}")
            except httpx.RequestError as err:
                raise MinerUError(f"无法连接至 MinerU 服务端 ({self.base_url}): {str(err)}")

            body = response.json()
            if body.get("code") != 0:
                raise MinerUError(body.get("msg", "无法创建 MinerU 解析任务。"))

            task_id = body.get("data", {}).get("task_id")
            if not task_id:
                raise MinerUError("MinerU 未返回有效的 task_id。")

            zip_url = await self._wait_for_result(client, headers, task_id)
            
            # When downloading pre-signed OSS CDN ZIP:
            # 1. Do NOT send custom Authorization headers
            # 2. Retry up to 3 times if CDN network drops
            archive_res = None
            last_download_err = None
            for attempt in range(1, 4):
                try:
                    res = await client.get(zip_url, headers={})
                    res.raise_for_status()
                    archive_res = res
                    break
                except httpx.HTTPStatusError as err:
                    last_download_err = f"HTTP {err.response.status_code}: {err.response.text}"
                    await asyncio.sleep(attempt * 2)
                except httpx.RequestError as err:
                    last_download_err = f"网络连接异常: {str(err)}"
                    await asyncio.sleep(attempt * 2)

            if not archive_res or not archive_res.is_success:
                raise MinerUError(f"下载 MinerU OSS CDN 解析包失败 ({zip_url}): {last_download_err}")

        return self.extract_archive(archive_res.content)

    async def _wait_for_result(self, client, headers, task_id):
        for _ in range(120):
            await asyncio.sleep(5)
            try:
                response = await client.get(f"{self.base_url}/extract/task/{task_id}", headers=headers)
                response.raise_for_status()
            except httpx.RequestError as err:
                raise MinerUError(f"轮询 MinerU 任务状态异常: {str(err)}")

            data = response.json().get("data") or {}
            if data.get("state") == "done" and data.get("full_zip_url"):
                return data["full_zip_url"]
            if data.get("state") == "failed":
                raise MinerUError(data.get("err_msg", "MinerU 解析文件失败。"))
        raise MinerUError("MinerU 任务超时（已等待 10 分钟）。")

    @staticmethod
    def extract_archive(payload: bytes) -> MinerUResult:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            names = [name for name in archive.namelist() if not name.endswith("/")]
            safe = [name for name in names if not PurePosixPath(name).is_absolute() and ".." not in PurePosixPath(name).parts]
            markdown = sorted((name for name in safe if name.lower().endswith(".md")), key=lambda n: ("full.md" not in n.lower(), len(n)))
            pdf = [name for name in safe if name.lower().endswith(".pdf") and not PurePosixPath(name).stem.lower().endswith(("_layout", "_span"))]
            if not markdown: raise MinerUError("MinerU 解析结果包中未提取到有效的 Markdown 文件。")
            return MinerUResult({name: archive.read(name) for name in safe}, markdown[0], pdf[0] if pdf else None)