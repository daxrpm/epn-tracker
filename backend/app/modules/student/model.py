"""Student models: profile, course states, enrollments and gradebook (ERS §12.18-12.23)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Boolean

from app.common.enums import (
    CourseState,
    CourseStateSource,
    EnglishLevel,
    EnrollmentState,
    GradeComponentMode,
    GraduationRequirementState,
)
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import Score, enum_column


class StudentProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_curriculum_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("curricula.id"), nullable=True
    )
    english_level: Mapped[EnglishLevel] = mapped_column(
        enum_column(EnglishLevel), default=EnglishLevel.NONE
    )
    english_sufficiency: Mapped[bool] = mapped_column(Boolean, default=False)
    english_last_required_level_enrolled: Mapped[bool] = mapped_column(Boolean, default=False)
    has_english_exception_authorization: Mapped[bool] = mapped_column(Boolean, default=False)


class StudentCourseState(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "student_course_states"

    student_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    curriculum_course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("curriculum_courses.id"))
    state: Mapped[CourseState] = mapped_column(
        enum_column(CourseState), default=CourseState.NOT_TAKEN
    )
    academic_period_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academic_periods.id"), nullable=True
    )
    final_score_40: Mapped[Decimal | None] = mapped_column(Score, nullable=True)
    final_score_20: Mapped[Decimal | None] = mapped_column(Score, nullable=True)
    source: Mapped[CourseStateSource] = mapped_column(
        enum_column(CourseStateSource), default=CourseStateSource.MANUAL
    )
    # Reserved for future repetition rules (ERS §4.3, §8.14).
    attempt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    withdrawal_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    annulment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    annulment_authorized: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class StudentEnrollment(UUIDMixin, TimestampMixin, Base):
    """A course the student is taking with its context (section/professor/scheme)."""

    __tablename__ = "student_enrollments"

    student_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    curriculum_course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("curriculum_courses.id"))
    academic_period_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academic_periods.id"), nullable=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sections.id"), nullable=True)
    professor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("professors.id"), nullable=True
    )
    evaluation_scheme_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("evaluation_schemes.id"), nullable=True
    )
    state: Mapped[EnrollmentState] = mapped_column(
        enum_column(EnrollmentState), default=EnrollmentState.ACTIVE
    )


class GradeComponentState(UUIDMixin, TimestampMixin, Base):
    """State of an evaluation component for a specific enrollment (ERS §12.21)."""

    __tablename__ = "grade_component_states"

    student_enrollment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_enrollments.id"))
    evaluation_component_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evaluation_components.id")
    )
    mode: Mapped[GradeComponentMode] = mapped_column(
        enum_column(GradeComponentMode), default=GradeComponentMode.EQUAL_AVERAGE
    )
    direct_score: Mapped[Decimal | None] = mapped_column(Score, nullable=True)
    calculated_score: Mapped[Decimal | None] = mapped_column(Score, nullable=True)
    score_scale: Mapped[Decimal] = mapped_column(Score, default=Decimal("20"))


class GradeItem(UUIDMixin, TimestampMixin, Base):
    """Internal item within a component (e.g. Homework 1). Private by default (ERS §8.9)."""

    __tablename__ = "grade_items"

    grade_component_state_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grade_component_states.id")
    )
    name: Mapped[str] = mapped_column(String(255))
    score: Mapped[Decimal | None] = mapped_column(Score, nullable=True)
    score_scale: Mapped[Decimal] = mapped_column(Score, default=Decimal("20"))
    internal_weight_percent: Mapped[Decimal | None] = mapped_column(Score, nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class StudentGraduationRequirementState(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "student_graduation_requirement_states"

    student_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_profiles.id"))
    graduation_requirement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("graduation_requirements.id")
    )
    state: Mapped[GraduationRequirementState] = mapped_column(
        enum_column(GraduationRequirementState), default=GraduationRequirementState.PENDING
    )
    completed_at: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
