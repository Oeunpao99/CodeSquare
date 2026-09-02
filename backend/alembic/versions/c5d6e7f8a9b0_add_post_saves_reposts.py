"""add post_saves and post_reposts

Revision ID: c5d6e7f8a9b0
Revises: b1c2d3e4f5a6
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _make(table: str) -> None:
    op.create_table(
        table,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("posts.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index(f"ix_{table}_post_id", table, ["post_id"])
    op.create_index(f"ix_{table}_user_id", table, ["user_id"])
    op.create_index(f"ix_{table}_created_at", table, ["created_at"])
    op.create_unique_constraint(f"uq_{table}_post_user", table, ["post_id", "user_id"])


def upgrade() -> None:
    _make("post_saves")
    _make("post_reposts")


def downgrade() -> None:
    op.drop_table("post_reposts")
    op.drop_table("post_saves")
