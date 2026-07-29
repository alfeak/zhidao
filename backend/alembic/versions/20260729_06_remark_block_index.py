"""bind remarks to language-independent Markdown block indexes"""
from alembic import op
import sqlalchemy as sa

revision = "20260729_06"
down_revision = "20260729_05"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("remarks") as batch:
        batch.add_column(sa.Column("block_index", sa.Integer(), nullable=True))
        batch.create_index("ix_remarks_block_index", ["block_index"])


def downgrade():
    with op.batch_alter_table("remarks") as batch:
        batch.drop_index("ix_remarks_block_index")
        batch.drop_column("block_index")
