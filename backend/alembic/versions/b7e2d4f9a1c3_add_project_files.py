"""projects: multi-file content (files JSON + entry path)

Revision ID: b7e2d4f9a1c3
Revises: eb31d802af64
Create Date: 2026-11-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e2d4f9a1c3"
down_revision: Union[str, None] = "eb31d802af64"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_projects", sa.Column("files", sa.JSON(), nullable=True))
    op.add_column("user_projects", sa.Column("entry", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_projects", "entry")
    op.drop_column("user_projects", "files")
