"""projects: ship info (repo/demo links, README, reflection)

Revision ID: e4a7c2d9f1b3
Revises: c9e0f1a2b3d4
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a7c2d9f1b3"
down_revision: Union[str, None] = "c9e0f1a2b3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_projects", sa.Column("ship", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_projects", "ship")
