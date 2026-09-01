"""Add post_comment_likes table (comment likes)

Revision ID: a6b7c8d9e0f1
Revises: a5b6c7d8e9f0
Create Date: 2026-09-01 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, None] = "a5b6c7d8e9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "post_comment_likes",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("comment_id", sa.Integer(), sa.ForeignKey("post_comments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_post_comment_likes_comment_user"),
    )
    op.create_index("ix_post_comment_likes_comment_id", "post_comment_likes", ["comment_id"])
    op.create_index("ix_post_comment_likes_user_id", "post_comment_likes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_post_comment_likes_user_id", table_name="post_comment_likes")
    op.drop_index("ix_post_comment_likes_comment_id", table_name="post_comment_likes")
    op.drop_table("post_comment_likes")