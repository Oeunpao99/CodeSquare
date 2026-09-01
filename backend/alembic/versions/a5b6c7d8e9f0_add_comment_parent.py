"""Add parent_id to post_comments (threaded replies)

Revision ID: a5b6c7d8e9f0
Revises: e7f8a9b0c1d2
Create Date: 2026-09-01 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a5b6c7d8e9f0"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "post_comments",
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("post_comments.id"), nullable=True),
    )
    op.create_index("ix_post_comments_parent_id", "post_comments", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_post_comments_parent_id", table_name="post_comments")
    op.drop_column("post_comments", "parent_id")