"""users: avatar_style (illustrated default avatar)

Revision ID: a9c4e7b2d5f8
Revises: f3b8d1c6a2e9
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9c4e7b2d5f8"
down_revision: Union[str, None] = "f3b8d1c6a2e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_style", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_style")
