"""Academic catalog models (ERS §12.1-12.9).

Key separation (ERS §33): catalog course != course within a curriculum != real offering.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Boolean

from app.common.enums import (
    CourseType,
    CurriculumStatus,
    GraduationRequirementType,
    OrganizationUnit,
    RequirementType,
    RuleOperator,
)
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import Credits, enum_column


class Institution(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String(255))
    acronym: Mapped[str] = mapped_column(String(20))


class Faculty(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "faculties"

    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("institutions.id"))
    name: Mapped[str] = mapped_column(String(255))
    acronym: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Career(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "careers"

    faculty_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("faculties.id"))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    degree_title: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Curriculum(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "curricula"
    __table_args__ = (
        UniqueConstraint("career_id", "pensum_year", name="uq_curriculum_career_year"),
    )

    career_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("careers.id"))
    name: Mapped[str] = mapped_column(String(255))
    pensum_year: Mapped[int] = mapped_column(Integer)
    total_credits: Mapped[Decimal] = mapped_column(Credits, default=Decimal("0"))
    total_hours: Mapped[int] = mapped_column(Integer, default=0)
    total_terms: Mapped[int] = mapped_column(Integer, default=9)
    total_courses_reported: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[CurriculumStatus] = mapped_column(
        enum_column(CurriculumStatus), default=CurriculumStatus.DRAFT
    )
    # Reserved for future scalability (ERS §4.3): equivalences / curriculum transition.
    supersedes_curriculum_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("curricula.id"), nullable=True
    )


class Course(UUIDMixin, TimestampMixin, Base):
    """Catalog course (independent of any curriculum)."""

    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="uq_course_institution_code"),
    )

    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("institutions.id"))
    code: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255), index=True)
    default_credits: Mapped[Decimal] = mapped_column(Credits, default=Decimal("0"))
    default_hours: Mapped[int] = mapped_column(Integer, default=0)
    course_type: Mapped[CourseType] = mapped_column(
        enum_column(CourseType), default=CourseType.REGULAR
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CurriculumCourse(UUIDMixin, TimestampMixin, Base):
    """A course placed within a curriculum (with its reference term and credits)."""

    __tablename__ = "curriculum_courses"
    __table_args__ = (
        UniqueConstraint("curriculum_id", "course_id", name="uq_curriculum_course"),
    )

    curriculum_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("curricula.id"))
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"))
    reference_term: Mapped[int] = mapped_column(Integer)
    credits: Mapped[Decimal] = mapped_column(Credits, default=Decimal("0"))
    hours: Mapped[int] = mapped_column(Integer, default=0)
    organization_unit: Mapped[OrganizationUnit] = mapped_column(
        enum_column(OrganizationUnit), default=OrganizationUnit.OTHER
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class CourseRequirement(UUIDMixin, TimestampMixin, Base):
    """Prerequisite or corequisite between courses of a curriculum (ERS §12.7)."""

    __tablename__ = "course_requirements"

    curriculum_course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("curriculum_courses.id"))
    required_curriculum_course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("curriculum_courses.id")
    )
    requirement_type: Mapped[RequirementType] = mapped_column(enum_column(RequirementType))
    rule_operator: Mapped[RuleOperator] = mapped_column(
        enum_column(RuleOperator), default=RuleOperator.ALL
    )
    is_strict: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class GraduationRequirement(UUIDMixin, TimestampMixin, Base):
    """Non-credit graduation requirement (English, sports, clubs, etc.) (ERS §8.19)."""

    __tablename__ = "graduation_requirements"
    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="uq_grad_req_institution_code"),
    )

    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("institutions.id"))
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255))
    requirement_type: Mapped[GraduationRequirementType] = mapped_column(
        enum_column(GraduationRequirementType)
    )
    grants_credits: Mapped[bool] = mapped_column(Boolean, default=False)
    credits: Mapped[Decimal | None] = mapped_column(Credits, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CurriculumGraduationRequirement(UUIDMixin, TimestampMixin, Base):
    """Associates a graduation requirement with a specific curriculum."""

    __tablename__ = "curriculum_graduation_requirements"
    __table_args__ = (
        UniqueConstraint(
            "curriculum_id", "graduation_requirement_id", name="uq_curriculum_grad_req"
        ),
    )

    curriculum_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("curricula.id"))
    graduation_requirement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("graduation_requirements.id")
    )


class AcademicPeriod(UUIDMixin, TimestampMixin, Base):
    """Real academic period, e.g. 2026-A (ERS §12.9)."""

    __tablename__ = "academic_periods"
    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="uq_period_institution_code"),
    )

    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("institutions.id"))
    code: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(255))
    starts_on: Mapped[str | None] = mapped_column(String(10), nullable=True)
    ends_on: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
