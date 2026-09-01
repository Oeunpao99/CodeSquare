"""Add follows table — follow/unfollow between users

Revision ID: d1e2f3a4b5c6
Revises: a8b9c0d1e2f3
Create Date: 2026-09-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("follower_id", sa.Integer(), nullable=False),
        sa.Column("following_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_follows_id", "follows", ["id"])
    op.create_index("ix_follows_follower_id", "follows", ["follower_id"])
    op.create_index("ix_follows_following_id", "follows", ["following_id"])
    op.create_unique_constraint("uq_follows_pair", "follows", ["follower_id", "following_id"])
    op.create_foreign_key("fk_follows_follower_id_users", "follows", "users", ["follower_id"], ["id"])
    op.create_foreign_key("fk_follows_following_id_users", "follows", "users", ["following_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_follows_following_id_users", "follows", type_="foreignkey")
    op.drop_constraint("fk_follows_follower_id_users", "follows", type_="foreignkey")
    op.drop_constraint("uq_follows_pair", "follows", type_="unique")
    op.drop_index("ix_follows_following_id", table_name="follows")
    op.drop_index("ix_follows_follower_id", table_name="follows")
    op.drop_index("ix_follows_id", table_name="follows")
    op.drop_table("follows")
