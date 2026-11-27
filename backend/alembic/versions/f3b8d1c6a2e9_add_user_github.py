"""users: github_username + encrypted github_token (Connect GitHub)

Revision ID: f3b8d1c6a2e9
Revises: e4a7c2d9f1b3
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3b8d1c6a2e9"
down_revision: Union[str, None] = "e4a7c2d9f1b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("github_username", sa.String(), nullable=True))
    op.add_column("users", sa.Column("github_token", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "github_token")
    op.drop_column("users", "github_username")
