"""Add per-user Library reading state (user_doc_progress)

One row per (user, topic) tracking `read` / `bookmarked`. Created lazily by the
docs router on first toggle — nothing to seed.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-08-29 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_doc_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=True),
        sa.Column("bookmarked", sa.Boolean(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["doc_topics.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_doc_progress_id", "user_doc_progress", ["id"])
    op.create_index("ix_user_doc_progress_user_id", "user_doc_progress", ["user_id"])
    op.create_index("ix_user_doc_progress_topic_id", "user_doc_progress", ["topic_id"])
    op.create_index(
        "ix_user_doc_progress_user_topic",
        "user_doc_progress",
        ["user_id", "topic_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_user_doc_progress_user_topic", table_name="user_doc_progress")
    op.drop_index("ix_user_doc_progress_topic_id", table_name="user_doc_progress")
    op.drop_index("ix_user_doc_progress_user_id", table_name="user_doc_progress")
    op.drop_index("ix_user_doc_progress_id", table_name="user_doc_progress")
    op.drop_table("user_doc_progress")
