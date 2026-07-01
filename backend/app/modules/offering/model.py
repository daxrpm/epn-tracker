"""Offering models: professors, offerings, sections (ERS §12.10-12.13)."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Boolean

from app.common.enums import CourseOfferingStatus, Modality, SectionProfessorRole
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import enum_column


class Professor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "professors"

    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("institutions.id"))
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CourseOffering(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "course_offerings"

    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"))
    academic_period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academic_periods.id"))
    curriculum_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("curricula.id"), nullable=True
    )
    status: Mapped[CourseOfferingStatus] = mapped_column(
        enum_column(CourseOfferingStatus), default=CourseOfferingStatus.ACTIVE
    )


class Section(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sections"

    course_offering_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_offerings.id"))
    section_code: Mapped[str] = mapped_column(String(50))
    modality: Mapped[Modality] = mapped_column(enum_column(Modality), default=Modality.UNKNOWN)


class SectionProfessor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "section_professors"

    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sections.id"))
    professor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("professors.id"))
    role: Mapped[SectionProfessorRole] = mapped_column(
        enum_column(SectionProfessorRole), default=SectionProfessorRole.PRIMARY
    )
