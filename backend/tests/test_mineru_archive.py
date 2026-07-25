from io import BytesIO
import zipfile

from backend.app.infrastructure.mineru_client import MinerUClient


def test_extract_archive_keeps_markdown_pdf_and_images():
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("result/full.md", "# Paper\n\n![figure](images/figure.png)")
        archive.writestr("result/full.pdf", b"%PDF-1.7\n")
        archive.writestr("result/images/figure.png", b"png-bytes")

    result = MinerUClient.extract_archive(buffer.getvalue())

    assert result.markdown.startswith("# Paper")
    assert result.pdf_bytes.startswith(b"%PDF-")
    assert result.assets == {"images/figure.png": b"png-bytes"}