from uuid import uuid4

from app.infrastructure.object_store import StoredObject
from app.infrastructure.repositories import PaperRepository


def test_save_artifacts_allows_retry_with_same_object_keys():
    repo = PaperRepository()
    paper_id = f"paper_retry_{uuid4().hex[:8]}"
    object_key = f"mineru/{paper_id}/full.md"

    repo.create({
        "id": paper_id,
        "title": "Retry Test",
        "url": f"https://example.com/{paper_id}.pdf",
        "importedAt": "2026-07-30T00:00:00+00:00",
    })

    artifacts = [StoredObject("full.md", object_key, "text/markdown", 128, "hash")]

    repo.save_artifacts(paper_id, artifacts)
    repo.save_artifacts(paper_id, artifacts)

    paper = repo.get(paper_id)
    assert paper is not None
    assert paper["isDecoded"] is True
    assert paper["markdownObjectKey"] == object_key
