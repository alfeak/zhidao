"""clear legacy placeholder parsing results"""
from alembic import op
from sqlalchemy import text

revision = "20260725_03"
down_revision = "20260725_02"
branch_labels = None
depends_on = None

def upgrade():
    op.execute(text("DELETE FROM markdown_blocks WHERE bbox = 'Document'"))
    op.execute(text("UPDATE papers SET is_decoded = 0, decode_status = 'pending', decode_error = NULL WHERE NOT EXISTS (SELECT 1 FROM markdown_blocks WHERE markdown_blocks.paper_id = papers.id)"))

def downgrade():
    pass