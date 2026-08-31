"""Add user profile fields: display_name, headline, bio, avatar_data, links, onboarded_at

Revision ID: a2b3c4d5e6f7
Revises: c1d2e3f4a5b6
Create Date: 2026-08-29 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_STRING_COLS = [
    "avatar_data",
    "display_name",
    "headline",
    "bio",
    "github_url",
    "website_url",
    "linkedin_url",
]


def upgrade() -> None:
    for col in _STRING_COLS:
        op.add_column("users", sa.Column(col, sa.String(), nullable=True))
    op.add_column("users", sa.Column("onboarded_at", sa.DateTime(), nullable=True))

    # Existing accounts have already been using the app — don't send them
    # through the first-run onboarding flow.
    op.execute("UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL")


def downgrade() -> None:
    op.drop_column("users", "onboarded_at")
    for col in reversed(_STRING_COLS):
        op.drop_column("users", col)
