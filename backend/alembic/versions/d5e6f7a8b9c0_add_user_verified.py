"""Add users.verified — everyone shows a verified badge on their public profile

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-08-31 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("verified", sa.Boolean(), nullable=True))
    op.execute("UPDATE users SET verified = TRUE WHERE verified IS NULL")
    op.alter_column("users", "verified", nullable=False)


def downgrade() -> None:
    op.drop_column("users", "verified")
