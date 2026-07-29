from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.services import PaperService
from app.infrastructure.object_store import StoredObject


@pytest.mark.asyncio
async def test_import_paper_uses_user_scoped_r2_settings():
    service = PaperService()
    url = "https://example.com/user-scoped-paper.pdf"
    paper_id = service.identifier_for_url(url)
    cached = [StoredObject("full.md", f"mineru/{paper_id}/full.md", "text/markdown", 128, "etag")]

    with (
        patch.object(service.title_resolver, "resolve", AsyncMock(return_value=SimpleNamespace(url=url, title="Scoped"))),
        patch.object(service.papers, "get", side_effect=[None, {"id": paper_id, "title": "Scoped", "url": url, "isDecoded": True, "decodeStatus": "done"}]),
        patch.object(service.papers, "create"),
        patch.object(service.papers, "save_artifacts"),
        patch.object(service, "reindex_paper") as mock_reindex,
        patch("app.application.services.R2ObjectStore") as mock_store,
    ):
        mock_store.return_value.list_cached_artifacts.return_value = cached

        paper = await service.import_paper(url, title="Scoped", user_id="user-123")

    mock_store.assert_called_once_with(user_id="user-123")
    mock_store.return_value.list_cached_artifacts.assert_called_once_with(paper_id)
    mock_reindex.assert_called_once_with(paper_id, user_id="user-123")
    assert paper["id"] == paper_id


def test_markdown_uses_user_scoped_r2_settings():
    service = PaperService()

    with (
        patch.object(service, "markdown_artifact", return_value=SimpleNamespace(object_key="mineru/paper/full.md")) as mock_artifact,
        patch("app.application.services.R2ObjectStore") as mock_store,
    ):
        mock_store.return_value.read.return_value = b"# Scoped Markdown"

        content, artifact = service.markdown("paper_123", user_id="user-123")

    mock_artifact.assert_called_once_with("paper_123")
    mock_store.assert_called_once_with(user_id="user-123")
    mock_store.return_value.read.assert_called_once_with("mineru/paper/full.md")
    assert content == "# Scoped Markdown"
    assert artifact.object_key == "mineru/paper/full.md"
