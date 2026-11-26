"""class quizzes, announcements, assignments + submissions

Revision ID: c1a55e5a2b30
Revises: d6e7f8a9b0c1
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1a55e5a2b30"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id"), nullable=True))
    op.add_column("quizzes", sa.Column("published", sa.Boolean(), nullable=True, server_default=sa.true()))
    op.create_index("ix_quizzes_class_id", "quizzes", ["class_id"])

    op.create_table(
        "class_posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_class_posts_id", "class_posts", ["id"])
    op.create_index("ix_class_posts_class_id", "class_posts", ["class_id"])
    op.create_index("ix_class_posts_created_at", "class_posts", ["created_at"])

    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("instructions", sa.String(), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("max_points", sa.Integer(), nullable=True),
        sa.Column("published", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_assignments_id", "assignments", ["id"])
    op.create_index("ix_assignments_class_id", "assignments", ["class_id"])

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("text", sa.String(), nullable=True),
        sa.Column("file_key", sa.String(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("grade", sa.Float(), nullable=True),
        sa.Column("feedback", sa.String(), nullable=True),
        sa.Column("graded_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_submissions_id", "submissions", ["id"])
    op.create_index("ix_submissions_assignment_id", "submissions", ["assignment_id"])
    op.create_index("ix_submissions_user_id", "submissions", ["user_id"])
    op.create_unique_constraint("uq_submissions_assignment_user", "submissions", ["assignment_id", "user_id"])


def downgrade() -> None:
    op.drop_table("submissions")
    op.drop_table("assignments")
    op.drop_table("class_posts")
    op.drop_index("ix_quizzes_class_id", table_name="quizzes")
    op.drop_column("quizzes", "published")
    op.drop_column("quizzes", "class_id")
