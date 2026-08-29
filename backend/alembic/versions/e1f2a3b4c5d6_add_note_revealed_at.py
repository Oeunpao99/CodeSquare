"""Add user_notes.revealed_at (credential reveal audit)

Stamped each time a credential secret is decrypted+shown; cleared when the secret
is changed or removed.

Revision ID: e1f2a3b4c5d6
Revises: c0de5qu4r3n0t3
Create Date: 2026-08-29 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "c0de5qu4r3n0t3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_notes", sa.Column("revealed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_notes", "revealed_at")
