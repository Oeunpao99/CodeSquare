"""Add the knowledge Library tables (doc_collections, doc_topics)

Creates the empty tables. Content is filled in by seed_docs.py (kept out of the
migration to avoid a wall of prose in version control).

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-28 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "doc_collections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doc_collections_id", "doc_collections", ["id"])
    op.create_index("ix_doc_collections_slug", "doc_collections", ["slug"], unique=True)

    op.create_table(
        "doc_topics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=True),
        sa.Column("slug", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("body", sa.String(), nullable=True),
        sa.Column("reading_minutes", sa.Integer(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("major_slugs", sa.JSON(), nullable=True),
        sa.Column("related_lesson_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["collection_id"], ["doc_collections.id"]),
        sa.ForeignKeyConstraint(["related_lesson_id"], ["lessons.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doc_topics_id", "doc_topics", ["id"])
    op.create_index("ix_doc_topics_slug", "doc_topics", ["slug"])


def downgrade() -> None:
    op.drop_index("ix_doc_topics_slug", table_name="doc_topics")
    op.drop_index("ix_doc_topics_id", table_name="doc_topics")
    op.drop_table("doc_topics")
    op.drop_index("ix_doc_collections_slug", table_name="doc_collections")
    op.drop_index("ix_doc_collections_id", table_name="doc_collections")
    op.drop_table("doc_collections")
