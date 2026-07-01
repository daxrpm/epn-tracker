"""use timezone-aware timestamps

Revision ID: 76f41b09b8c2
Revises: 2ea23234de1d
Create Date: 2026-07-01 17:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "76f41b09b8c2"
down_revision: str | None = "2ea23234de1d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TIMESTAMP_TABLES = (
    "institutions",
    "users",
    "academic_periods",
    "audit_logs",
    "courses",
    "faculties",
    "graduation_requirements",
    "professors",
    "careers",
    "curricula",
    "course_offerings",
    "curriculum_courses",
    "curriculum_graduation_requirements",
    "student_profiles",
    "course_requirements",
    "sections",
    "simulations",
    "student_course_states",
    "student_graduation_requirement_states",
    "evaluation_schemes",
    "section_professors",
    "evaluation_components",
    "evaluation_scheme_audits",
    "evaluation_scheme_votes",
    "student_enrollments",
    "grade_component_states",
    "grade_items",
)


def _make_aware(table: str, column: str) -> None:
    op.alter_column(
        table,
        column,
        existing_type=sa.DateTime(timezone=False),
        type_=sa.DateTime(timezone=True),
        existing_nullable=column == "email_verified_at",
        postgresql_using=f"{column} AT TIME ZONE 'UTC'",
    )


def _make_naive(table: str, column: str) -> None:
    op.alter_column(
        table,
        column,
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(timezone=False),
        existing_nullable=column == "email_verified_at",
        postgresql_using=f"{column} AT TIME ZONE 'UTC'",
    )


def upgrade() -> None:
    for table in _TIMESTAMP_TABLES:
        _make_aware(table, "created_at")
        _make_aware(table, "updated_at")
    _make_aware("users", "email_verified_at")


def downgrade() -> None:
    _make_naive("users", "email_verified_at")
    for table in reversed(_TIMESTAMP_TABLES):
        _make_naive(table, "updated_at")
        _make_naive(table, "created_at")
