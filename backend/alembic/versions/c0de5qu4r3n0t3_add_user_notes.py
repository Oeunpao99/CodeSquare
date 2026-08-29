"""Add CodeSquareNote (user_notes) table

One-tap scratchpad for project requirements & reminders ("note"), AI-structured
project templates ("project"), and encrypted credentials ("credential").

Revision ID: c0de5qu4r3n0t3
Revises: d0e1f2a3b4c5
Create Date: 2026-08-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c0de5qu4r3n0t3"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("content", sa.String(), nullable=True),
        sa.Column("ai_suggestion", sa.JSON(), nullable=True),
        sa.Column("secret", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.execute("UPDATE user_notes SET kind = 'note' WHERE kind IS NULL")


def downgrade() -> None:
    op.drop_table("user_notes")
