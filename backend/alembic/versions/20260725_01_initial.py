"""initial ORM schema"""
from alembic import op
from app.infrastructure.orm_models import Base

revision = "20260725_01"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    Base.metadata.create_all(bind=op.get_bind())

def downgrade():
    Base.metadata.drop_all(bind=op.get_bind())
