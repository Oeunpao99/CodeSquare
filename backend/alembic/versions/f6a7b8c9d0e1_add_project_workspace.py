"""Add project-workspace fields to user_projects

notes (markdown), brief (JSON), tasks (JSON), status, pinned, track_slug.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-28 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_projects", sa.Column("notes", sa.String(), nullable=True))
    op.add_column("user_projects", sa.Column("brief", sa.JSON(), nullable=True))
    op.add_column("user_projects", sa.Column("tasks", sa.JSON(), nullable=True))
    op.add_column("user_projects", sa.Column("status", sa.String(), nullable=True))
    op.add_column("user_projects", sa.Column("pinned", sa.Boolean(), nullable=True))
    op.add_column("user_projects", sa.Column("track_slug", sa.String(), nullable=True))
    op.execute("UPDATE user_projects SET notes = '' WHERE notes IS NULL")
    op.execute("UPDATE user_projects SET tasks = '[]' WHERE tasks IS NULL")
    op.execute("UPDATE user_projects SET status = 'active' WHERE status IS NULL")
    op.execute("UPDATE user_projects SET pinned = false WHERE pinned IS NULL")


def downgrade() -> None:
    for col in ("track_slug", "pinned", "status", "tasks", "brief", "notes"):
        op.drop_column("user_projects", col)
