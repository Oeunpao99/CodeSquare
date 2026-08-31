"""Add posts.public_id — opaque, non-sequential id for post URLs

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-08-31 12:00:00.000000

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("public_id", sa.String(), nullable=True))

    conn = op.get_bind()
    ids = [r[0] for r in conn.execute(sa.text("SELECT id FROM posts WHERE public_id IS NULL"))]
    for pid in ids:
        conn.execute(
            sa.text("UPDATE posts SET public_id = :v WHERE id = :id"),
            {"v": secrets.token_urlsafe(9), "id": pid},
        )

    op.create_index("ix_posts_public_id", "posts", ["public_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_posts_public_id", table_name="posts")
    op.drop_column("posts", "public_id")
