"""Add standalone quizzes (quizzes, quiz_attempts)

Creates the empty tables. Content is filled in by seed_quizzes.py (kept out of
the migration to avoid a wall of question text in version control).

Revision ID: c1d2e3f4a5b6
Revises: b4c5d6e7f8a9
Create Date: 2026-08-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quizzes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("module_id", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("pass_score", sa.Integer(), nullable=True),
        sa.Column("xp_reward", sa.Integer(), nullable=True),
        sa.Column("questions", sa.JSON(), nullable=True),
        sa.Column("major_slugs", sa.JSON(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quizzes_id", "quizzes", ["id"])
    op.create_index("ix_quizzes_slug", "quizzes", ["slug"], unique=True)

    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("quiz_id", sa.Integer(), nullable=True),
        sa.Column("answers", sa.JSON(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("correct", sa.Integer(), nullable=True),
        sa.Column("total", sa.Integer(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quiz_attempts_id", "quiz_attempts", ["id"])
    op.create_index("ix_quiz_attempts_user_id", "quiz_attempts", ["user_id"])
    op.create_index("ix_quiz_attempts_quiz_id", "quiz_attempts", ["quiz_id"])


def downgrade() -> None:
    op.drop_index("ix_quiz_attempts_quiz_id", table_name="quiz_attempts")
    op.drop_index("ix_quiz_attempts_user_id", table_name="quiz_attempts")
    op.drop_index("ix_quiz_attempts_id", table_name="quiz_attempts")
    op.drop_table("quiz_attempts")
    op.drop_index("ix_quizzes_slug", table_name="quizzes")
    op.drop_index("ix_quizzes_id", table_name="quizzes")
    op.drop_table("quizzes")
