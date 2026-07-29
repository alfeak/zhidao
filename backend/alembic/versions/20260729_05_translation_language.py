"""record the BCP 47 code for each translated Markdown artifact"""
from alembic import op
import sqlalchemy as sa

revision = "20260729_05"
down_revision = "20260725_04"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("document_artifacts") as batch:
        batch.add_column(sa.Column("translation_language", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("document_artifacts") as batch:
        batch.drop_column("translation_language")
