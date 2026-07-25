"""mark cleared legacy papers as ready for retry"""
from alembic import op
from sqlalchemy import text

revision = "20260725_04"
down_revision = "20260725_03"
branch_labels = None
depends_on = None

def upgrade():
    op.execute(text("UPDATE papers SET decode_status = 'failed', decode_error = 'Previous placeholder result was removed. Retry with MinerU to parse this paper.' WHERE is_decoded = 0 AND decode_status = 'pending' AND NOT EXISTS (SELECT 1 FROM markdown_blocks WHERE markdown_blocks.paper_id = papers.id)"))

def downgrade():
    pass