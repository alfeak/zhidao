from unittest.mock import MagicMock, patch
import pytest
from app.application.services import PaperService
from app.infrastructure.object_store import StoredObject

def test_identifier_for_url_is_deterministic():
    url = "https://arxiv.org/pdf/2301.00001.pdf"
    id1 = PaperService.identifier_for_url(url)
    id2 = PaperService.identifier_for_url(url)
    assert id1 == id2
    assert id1.startswith("paper_")

@pytest.mark.asyncio
async def test_import_paper_reuses_r2_cache():
    service = PaperService()
    url = "https://example.com/test_paper.pdf"
    paper_id = service.identifier_for_url(url)

    mock_cached = [
        StoredObject("full.md", f"mineru/{paper_id}/full.md", "text/markdown", 500, "hash1"),
        StoredObject("full.pdf", f"mineru/{paper_id}/full.pdf", "application/pdf", 2000, "hash2")
    ]

    with patch("app.application.services.R2ObjectStore.list_cached_artifacts", return_value=mock_cached):
        paper = await service.import_paper(url, title="Test Paper")
        assert paper["id"] == paper_id
        assert paper["isDecoded"] is True
        assert paper["decodeStatus"] == "done"

@pytest.mark.asyncio
async def test_delete_paper_keeps_r2_and_reimport_reuses_cache():
    service = PaperService()
    url = "https://example.com/test_delete_reimport.pdf"
    paper_id = service.identifier_for_url(url)

    mock_cached = [
        StoredObject("full.md", f"mineru/{paper_id}/full.md", "text/markdown", 500, "hash1"),
    ]

    with patch("app.application.services.R2ObjectStore.list_cached_artifacts", return_value=mock_cached):
        # 1. Import paper
        paper = await service.import_paper(url, title="Delete Test")
        assert paper["isDecoded"] is True

        # 2. Delete paper from DB
        service.delete_paper(paper_id)
        assert service.papers.get(paper_id) is None

        # 3. Re-import paper: should reuse R2 cache without re-parsing
        reimported = await service.import_paper(url, title="Delete Test")
        assert reimported["id"] == paper_id
        assert reimported["isDecoded"] is True
