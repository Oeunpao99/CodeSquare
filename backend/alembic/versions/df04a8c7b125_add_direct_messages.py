"""Add private messages between developers."""

from alembic import op
import sqlalchemy as sa

revision = "df04a8c7b125"
down_revision = "a9c4e7b2d5f8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "direct_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("media_key", sa.String(), nullable=True),
        sa.Column("media_type", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_dm_sender_recipient_id", "direct_messages", ["sender_id", "recipient_id", "id"])
    op.create_index("ix_dm_recipient_sender_id", "direct_messages", ["recipient_id", "sender_id", "id"])


def downgrade():
    op.drop_table("direct_messages")
