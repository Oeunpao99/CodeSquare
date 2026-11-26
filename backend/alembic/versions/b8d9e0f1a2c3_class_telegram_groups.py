"""multiple Telegram groups per class

Revision ID: b8d9e0f1a2c3
Revises: a7c8d9e0f1b2
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d9e0f1a2c3"
down_revision: Union[str, None] = "a7c8d9e0f1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "class_telegram_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chat_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_class_telegram_groups_id", "class_telegram_groups", ["id"])
    op.create_index("ix_class_telegram_groups_class_id", "class_telegram_groups", ["class_id"])
    op.create_unique_constraint("uq_class_telegram_group", "class_telegram_groups", ["class_id", "chat_id"])
    # Carry over groups connected with the single-group version.
    op.execute(
        "INSERT INTO class_telegram_groups (class_id, chat_id, title, created_at) "
        "SELECT id, telegram_chat_id, COALESCE(telegram_chat_title, 'Telegram group'), NOW() "
        "FROM classrooms WHERE telegram_chat_id IS NOT NULL"
    )
    op.drop_column("classrooms", "telegram_chat_id")
    op.drop_column("classrooms", "telegram_chat_title")


def downgrade() -> None:
    op.add_column("classrooms", sa.Column("telegram_chat_title", sa.String(), nullable=True))
    op.add_column("classrooms", sa.Column("telegram_chat_id", sa.String(), nullable=True))
    op.execute(
        "UPDATE classrooms c SET telegram_chat_id = g.chat_id, telegram_chat_title = g.title "
        "FROM (SELECT DISTINCT ON (class_id) class_id, chat_id, title FROM class_telegram_groups ORDER BY class_id, id) g "
        "WHERE g.class_id = c.id"
    )
    op.drop_table("class_telegram_groups")
