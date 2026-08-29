"""Add modules.level (rung on the track's beginner->advanced ladder)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-28 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("modules", sa.Column("level", sa.Integer(), nullable=True))
    # Seed level from the existing order so nothing looks empty pre-retag.
    op.execute('UPDATE modules SET level = "order" WHERE level IS NULL')


def downgrade() -> None:
    op.drop_column("modules", "level")
