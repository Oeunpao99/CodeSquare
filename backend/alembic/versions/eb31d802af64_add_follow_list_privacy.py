"""Add a user setting for follower and following list visibility."""

from alembic import op
import sqlalchemy as sa

revision = "eb31d802af64"
down_revision = "d7a65c4e921b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("follow_lists_private", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("users", "follow_lists_private")
