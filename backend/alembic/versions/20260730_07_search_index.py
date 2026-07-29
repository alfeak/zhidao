"""add local FTS5 search index"""
from alembic import op

revision = "20260730_07"
down_revision = "20260729_06"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS paper_search "
        "USING fts5(paper_id UNINDEXED, source UNINDEXED, language UNINDEXED, "
        "block_index UNINDEXED, page_index UNINDEXED, title, content, tokenize='trigram')"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS paper_search")
