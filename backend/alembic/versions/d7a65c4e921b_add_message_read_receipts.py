"""Track how far each participant has read a direct conversation."""

from alembic import op
import sqlalchemy as sa

revision = "d7a65c4e921b"
down_revision = "df04a8c7b125"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "direct_message_reads",
        sa.Column("reader_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("peer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("through_id", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("direct_message_reads")
