"""Add Account & Usage: user_ai_usage table + users.plan

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-08-29 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("plan", sa.String(), nullable=True))
    op.execute("UPDATE users SET plan = 'free' WHERE plan IS NULL")

    op.create_table(
        "user_ai_usage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_ai_usage_id", "user_ai_usage", ["id"])
    op.create_index("ix_user_ai_usage_user_id", "user_ai_usage", ["user_id"])
    op.create_index("ix_user_ai_usage_kind", "user_ai_usage", ["kind"])
    op.create_index("ix_user_ai_usage_created_at", "user_ai_usage", ["created_at"])
    op.create_index(
        "ix_user_ai_usage_user_created", "user_ai_usage", ["user_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_ai_usage_user_created", table_name="user_ai_usage")
    op.drop_index("ix_user_ai_usage_created_at", table_name="user_ai_usage")
    op.drop_index("ix_user_ai_usage_kind", table_name="user_ai_usage")
    op.drop_index("ix_user_ai_usage_user_id", table_name="user_ai_usage")
    op.drop_index("ix_user_ai_usage_id", table_name="user_ai_usage")
    op.drop_table("user_ai_usage")
    op.drop_column("users", "plan")
