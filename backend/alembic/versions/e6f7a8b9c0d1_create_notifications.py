"""Create notifications — dev team likes/comments on your posts

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-08-31 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_actor_id", "notifications", ["actor_id"])
    op.create_index("ix_notifications_post_id", "notifications", ["post_id"])
    op.create_index("ix_notifications_read", "notifications", ["read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_foreign_key("fk_notifications_user_id_users", "notifications", "users", ["user_id"], ["id"])
    op.create_foreign_key("fk_notifications_actor_id_users", "notifications", "users", ["actor_id"], ["id"])
    op.create_foreign_key("fk_notifications_post_id_posts", "notifications", "posts", ["post_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_notifications_post_id_posts", "notifications", type_="foreignkey")
    op.drop_constraint("fk_notifications_actor_id_users", "notifications", type_="foreignkey")
    op.drop_constraint("fk_notifications_user_id_users", "notifications", type_="foreignkey")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_read", table_name="notifications")
    op.drop_index("ix_notifications_post_id", table_name="notifications")
    op.drop_index("ix_notifications_actor_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_index("ix_notifications_id", table_name="notifications")
    op.drop_table("notifications")