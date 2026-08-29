"""Add challenges.kind ("solve" | "debug")

Existing rows are backfilled to "solve". Debug challenges ship broken code in
`starter_code` for the user to fix; seed_debug_challenges.py populates them.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-08-29 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("challenges", sa.Column("kind", sa.String(), nullable=True))
    op.execute("UPDATE challenges SET kind = 'solve' WHERE kind IS NULL")


def downgrade() -> None:
    op.drop_column("challenges", "kind")
