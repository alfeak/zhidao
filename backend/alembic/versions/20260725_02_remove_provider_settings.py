"""remove legacy provider settings"""
from alembic import op
from sqlalchemy import text

revision = "20260725_02"
down_revision = "20260725_01"
branch_labels = None
depends_on = None

def upgrade():
    op.execute(text("DELETE FROM models WHERE base_url = ''"))
    op.drop_table("settings")

def downgrade():
    op.create_table("settings")