import asyncio
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

from backend.app.application.services import PaperService

ARXIV_URL = "https://arxiv.org/pdf/1907.03739.pdf"
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

@pytest.mark.integration
def test_mineru_parses_arxiv_pdf_and_markdown():
    if not os.getenv("MINERU_API_TOKEN", "").strip():
        pytest.skip("MINERU_API_TOKEN is required for the real MinerU integration test.")

    service = PaperService()
    paper = asyncio.run(service.import_paper(ARXIV_URL))
    try:
        asyncio.run(service.decode(paper["id"]))
        parsed = service.papers.get(paper["id"])
        pdf_path = service.cache_dir / f"{paper['id']}.pdf"

        assert parsed is not None
        assert parsed["decodeStatus"] == "done", parsed.get("decodeError")
        assert parsed["isDecoded"] is True
        assert parsed["mdBlocks"], "MinerU returned no Markdown blocks"
        assert any(block["content"].strip() for block in parsed["mdBlocks"])
        assert pdf_path.exists(), "MinerU ZIP PDF was not saved"
        assert pdf_path.stat().st_size > 1024
        assert pdf_path.read_bytes().startswith(b"%PDF")
    finally:
        service.delete_paper(paper["id"])