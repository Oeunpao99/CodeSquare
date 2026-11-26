"""add classes: teacher_profiles, classrooms, class_members, class_sections, class_materials

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teacher_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("organization", sa.String(), nullable=True),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("bio", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("review_note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_teacher_profiles_id", "teacher_profiles", ["id"])
    op.create_index("ix_teacher_profiles_user_id", "teacher_profiles", ["user_id"], unique=True)
    op.create_index("ix_teacher_profiles_status", "teacher_profiles", ["status"])

    op.create_table(
        "classrooms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(), nullable=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("join_code", sa.String(), nullable=True),
        sa.Column("code_enabled", sa.Boolean(), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_classrooms_id", "classrooms", ["id"])
    op.create_index("ix_classrooms_public_id", "classrooms", ["public_id"], unique=True)
    op.create_index("ix_classrooms_owner_id", "classrooms", ["owner_id"])
    op.create_index("ix_classrooms_join_code", "classrooms", ["join_code"], unique=True)

    op.create_table(
        "class_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_class_members_id", "class_members", ["id"])
    op.create_index("ix_class_members_class_id", "class_members", ["class_id"])
    op.create_index("ix_class_members_user_id", "class_members", ["user_id"])
    op.create_unique_constraint("uq_class_members_class_user", "class_members", ["class_id", "user_id"])

    op.create_table(
        "class_sections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("published", sa.Boolean(), nullable=True),
        sa.Column("release_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_class_sections_id", "class_sections", ["id"])
    op.create_index("ix_class_sections_class_id", "class_sections", ["class_id"])

    op.create_table(
        "class_materials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("section_id", sa.Integer(), sa.ForeignKey("class_sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("file_key", sa.String(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_class_materials_id", "class_materials", ["id"])
    op.create_index("ix_class_materials_section_id", "class_materials", ["section_id"])


def downgrade() -> None:
    op.drop_table("class_materials")
    op.drop_table("class_sections")
    op.drop_table("class_members")
    op.drop_table("classrooms")
    op.drop_table("teacher_profiles")
