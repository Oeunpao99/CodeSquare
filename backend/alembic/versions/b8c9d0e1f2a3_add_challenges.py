"""Add Practice challenges (challenges, challenge_attempts)

Creates the empty tables. Content is filled in by seed_challenges.py (kept out of
the migration to avoid a wall of problem text in version control).

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-08-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "challenges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("prompt", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("starter_code", sa.String(), nullable=True),
        sa.Column("solution", sa.String(), nullable=True),
        sa.Column("test_cases", sa.JSON(), nullable=True),
        sa.Column("hints", sa.JSON(), nullable=True),
        sa.Column("xp_reward", sa.Integer(), nullable=True),
        sa.Column("major_slugs", sa.JSON(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenges_id", "challenges", ["id"])
    op.create_index("ix_challenges_slug", "challenges", ["slug"], unique=True)

    op.create_table(
        "challenge_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("challenge_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=True),
        sa.Column("tests_passed", sa.Integer(), nullable=True),
        sa.Column("tests_total", sa.Integer(), nullable=True),
        sa.Column("ai_review", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["challenge_id"], ["challenges.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_challenge_attempts_id", "challenge_attempts", ["id"])
    op.create_index(
        "ix_challenge_attempts_user_challenge",
        "challenge_attempts",
        ["user_id", "challenge_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_challenge_attempts_user_challenge", table_name="challenge_attempts")
    op.drop_index("ix_challenge_attempts_id", table_name="challenge_attempts")
    op.drop_table("challenge_attempts")
    op.drop_index("ix_challenges_slug", table_name="challenges")
    op.drop_index("ix_challenges_id", table_name="challenges")
    op.drop_table("challenges")
