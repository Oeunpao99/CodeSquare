"""Add doc_topics.group_level / group_difficulty (Library learning-path ladder)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-28 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("doc_topics", sa.Column("group_level", sa.Integer(), nullable=True))
    op.add_column("doc_topics", sa.Column("group_difficulty", sa.String(), nullable=True))
    op.execute("UPDATE doc_topics SET group_level = 1 WHERE group_level IS NULL")


def downgrade() -> None:
    op.drop_column("doc_topics", "group_difficulty")
    op.drop_column("doc_topics", "group_level")
