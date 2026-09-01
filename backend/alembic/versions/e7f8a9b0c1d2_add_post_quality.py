"""Add AI quality review fields to posts

Revision ID: e7f8a9b0c1d2
Revises: d1e2f3a4b5c6
Create Date: 2026-09-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("quality_score", sa.Integer(), nullable=True))
    op.add_column("posts", sa.Column("quality_note", sa.String(), nullable=True))
    op.add_column("posts", sa.Column("quality_ai", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("posts", "quality_ai")
    op.drop_column("posts", "quality_note")
    op.drop_column("posts", "quality_score")