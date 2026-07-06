"""add resources and resource_votes

Revision ID: 26bf50491b15
Revises: 28e6246549d2
Create Date: 2026-07-06 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "26bf50491b15"
down_revision: str | None = "28e6246549d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("academic_period_id", sa.Uuid(), nullable=True),
        sa.Column("professor_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tema", sa.String(length=255), nullable=True),
        sa.Column(
            "contribution",
            sa.Enum("APORTE_1", "APORTE_2", name="contribution", native_enum=False, length=40),
            nullable=True,
        ),
        sa.Column(
            "kind",
            sa.Enum(
                "PDF",
                "IMAGE",
                "MARKDOWN",
                "TEXT",
                "OFFICE",
                "LINK",
                name="resourcekind",
                native_enum=False,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PERSONAL",
                "COMMUNITY_PENDING",
                "COMMUNITY_VERIFIED",
                "ADMIN_VERIFIED",
                "REJECTED",
                "ARCHIVED",
                name="resourcestatus",
                native_enum=False,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column(
            "visibility",
            sa.Enum(
                "PRIVATE", "COMMUNITY", "PUBLIC", name="visibility", native_enum=False, length=40
            ),
            nullable=False,
        ),
        sa.Column("approval_count", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=True),
        sa.Column("bucket", sa.String(length=128), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("text_extracted", sa.Boolean(), nullable=False),
        sa.Column("embedding_status", sa.String(length=32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["academic_period_id"],
            ["academic_periods.id"],
            name=op.f("fk_resources_academic_period_id_academic_periods"),
        ),
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], name=op.f("fk_resources_course_id_courses")
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name=op.f("fk_resources_created_by_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["professor_id"],
            ["professors.id"],
            name=op.f("fk_resources_professor_id_professors"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resources")),
    )
    op.create_index(
        op.f("ix_resources_checksum_sha256"), "resources", ["checksum_sha256"], unique=False
    )
    op.create_index(op.f("ix_resources_course_id"), "resources", ["course_id"], unique=False)
    op.create_index(
        op.f("ix_resources_professor_id"), "resources", ["professor_id"], unique=False
    )
    op.create_index(op.f("ix_resources_tema"), "resources", ["tema"], unique=False)

    op.create_table(
        "resource_votes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "vote",
            sa.Enum("APPROVE", "REJECT", name="schemevote", native_enum=False, length=40),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["resource_id"],
            ["resources.id"],
            name=op.f("fk_resource_votes_resource_id_resources"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_resource_votes_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resource_votes")),
        sa.UniqueConstraint("resource_id", "user_id", name="uq_resource_vote_user"),
    )
    op.create_index(
        op.f("ix_resource_votes_resource_id"), "resource_votes", ["resource_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_resource_votes_resource_id"), table_name="resource_votes")
    op.drop_table("resource_votes")
    op.drop_index(op.f("ix_resources_tema"), table_name="resources")
    op.drop_index(op.f("ix_resources_professor_id"), table_name="resources")
    op.drop_index(op.f("ix_resources_course_id"), table_name="resources")
    op.drop_index(op.f("ix_resources_checksum_sha256"), table_name="resources")
    op.drop_table("resources")
