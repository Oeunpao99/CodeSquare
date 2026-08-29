"""Add doc_ratings (per-user 1-5 star rating of a Library shelf)

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-08-29 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "doc_ratings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("collection_id", sa.Integer(), nullable=True),
        sa.Column("stars", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["collection_id"], ["doc_collections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doc_ratings_id", "doc_ratings", ["id"])
    op.create_index("ix_doc_ratings_user_id", "doc_ratings", ["user_id"])
    op.create_index("ix_doc_ratings_collection_id", "doc_ratings", ["collection_id"])
    op.create_index(
        "ix_doc_ratings_user_collection", "doc_ratings", ["user_id", "collection_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_doc_ratings_user_collection", table_name="doc_ratings")
    op.drop_index("ix_doc_ratings_collection_id", table_name="doc_ratings")
    op.drop_index("ix_doc_ratings_user_id", table_name="doc_ratings")
    op.drop_index("ix_doc_ratings_id", table_name="doc_ratings")
    op.drop_table("doc_ratings")
