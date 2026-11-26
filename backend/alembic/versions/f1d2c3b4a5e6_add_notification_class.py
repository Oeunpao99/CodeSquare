"""notifications.class_id for class notifications (added to class, announcements, assignments)

Revision ID: f1d2c3b4a5e6
Revises: c1a55e5a2b30
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1d2c3b4a5e6"
down_revision: Union[str, None] = "c1a55e5a2b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=True))
    op.create_index("ix_notifications_class_id", "notifications", ["class_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_class_id", table_name="notifications")
    op.drop_column("notifications", "class_id")
