"""Add the recovery score and the uniqueness constraints the services already assume.

Two kinds of change:

* ``student_enrollments.recovery_score_40`` closes the makeup-exam flow (ERS §8.5-8.6). It was
  computable in the domain layer but had nowhere to live.
* Three unique constraints turn invariants the services check into invariants the database
  guarantees, which is what makes them hold under concurrent requests.

The constraints are added defensively: a database that already contains duplicates would reject
the migration, so each one de-duplicates first, keeping the oldest row.

Revision ID: a1c4f7e2b930
Revises: 26bf50491b15
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1c4f7e2b930"
down_revision: str | None = "26bf50491b15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _delete_duplicates(table: str, columns: Sequence[str]) -> None:
    """Keep the earliest row of each duplicate group so the unique constraint can be created."""
    key = ", ".join(columns)
    op.execute(
        sa.text(
            f"""
            DELETE FROM {table}
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY {key} ORDER BY created_at, id
                           ) AS row_number
                    FROM {table}
                ) ranked
                WHERE ranked.row_number > 1
            )
            """
        )
    )


def upgrade() -> None:
    op.add_column(
        "student_enrollments",
        sa.Column("recovery_score_40", sa.Numeric(precision=12, scale=4), nullable=True),
    )

    _delete_duplicates("student_enrollments", ("student_profile_id", "curriculum_course_id"))
    op.create_unique_constraint(
        "uq_enrollment_student_course",
        "student_enrollments",
        ["student_profile_id", "curriculum_course_id"],
    )

    _delete_duplicates("course_offerings", ("course_id", "academic_period_id"))
    op.create_unique_constraint(
        "uq_offering_course_period",
        "course_offerings",
        ["course_id", "academic_period_id"],
    )

    _delete_duplicates("sections", ("course_offering_id", "section_code"))
    op.create_unique_constraint(
        "uq_section_offering_code",
        "sections",
        ["course_offering_id", "section_code"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_section_offering_code", "sections", type_="unique")
    op.drop_constraint("uq_offering_course_period", "course_offerings", type_="unique")
    op.drop_constraint("uq_enrollment_student_course", "student_enrollments", type_="unique")
    op.drop_column("student_enrollments", "recovery_score_40")
