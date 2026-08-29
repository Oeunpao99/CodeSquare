"""Add AI-Tutor chat history: ai_chat_sessions + ai_chat_turns

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-08-29 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_chat_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_chat_sessions_id", "ai_chat_sessions", ["id"])
    op.create_index("ix_ai_chat_sessions_user_id", "ai_chat_sessions", ["user_id"])
    op.create_index("ix_ai_chat_sessions_updated_at", "ai_chat_sessions", ["updated_at"])

    op.create_table(
        "ai_chat_turns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("content", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["ai_chat_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_chat_turns_id", "ai_chat_turns", ["id"])
    op.create_index("ix_ai_chat_turns_session_id", "ai_chat_turns", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_chat_turns_session_id", table_name="ai_chat_turns")
    op.drop_index("ix_ai_chat_turns_id", table_name="ai_chat_turns")
    op.drop_table("ai_chat_turns")
    op.drop_index("ix_ai_chat_sessions_updated_at", table_name="ai_chat_sessions")
    op.drop_index("ix_ai_chat_sessions_user_id", table_name="ai_chat_sessions")
    op.drop_index("ix_ai_chat_sessions_id", table_name="ai_chat_sessions")
    op.drop_table("ai_chat_sessions")
