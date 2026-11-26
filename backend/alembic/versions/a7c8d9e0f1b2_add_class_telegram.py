"""classrooms: telegram group link

Revision ID: a7c8d9e0f1b2
Revises: f1d2c3b4a5e6
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c8d9e0f1b2"
down_revision: Union[str, None] = "f1d2c3b4a5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("classrooms", sa.Column("telegram_chat_id", sa.String(), nullable=True))
    op.add_column("classrooms", sa.Column("telegram_chat_title", sa.String(), nullable=True))
    op.add_column("classrooms", sa.Column("telegram_link_token", sa.String(), nullable=True))
    op.create_index("ix_classrooms_telegram_link_token", "classrooms", ["telegram_link_token"])


def downgrade() -> None:
    op.drop_index("ix_classrooms_telegram_link_token", table_name="classrooms")
    op.drop_column("classrooms", "telegram_link_token")
    op.drop_column("classrooms", "telegram_chat_title")
    op.drop_column("classrooms", "telegram_chat_id")
