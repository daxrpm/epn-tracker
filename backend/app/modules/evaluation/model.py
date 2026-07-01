"""Modelos de evaluación: esquemas, componentes, votos y auditoría (ERS §12.14-12.16)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Boolean

from app.common.enums import (
    Contribution,
    EvaluationSchemeStatus,
    EvaluationType,
    SchemeSourceType,
    SchemeVote,
    Visibility,
)
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import Score, enum_column


class EvaluationScheme(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evaluation_schemes"

    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"))
    academic_period_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academic_periods.id"), nullable=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sections.id"), nullable=True)
    professor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("professors.id"), nullable=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[EvaluationSchemeStatus] = mapped_column(
        enum_column(EvaluationSchemeStatus), default=EvaluationSchemeStatus.PERSONAL
    )
    visibility: Mapped[Visibility] = mapped_column(
        enum_column(Visibility), default=Visibility.PRIVATE
    )
    source_type: Mapped[SchemeSourceType] = mapped_column(
        enum_column(SchemeSourceType), default=SchemeSourceType.MANUAL_STUDENT
    )
    approval_count: Mapped[int] = mapped_column(Integer, default=0)
    revision_number: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Contexto para verificación comunitaria (ERS §21.3).
    context_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)


class EvaluationComponent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evaluation_components"

    evaluation_scheme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evaluation_schemes.id"))
    contribution: Mapped[Contribution] = mapped_column(enum_column(Contribution))
    name: Mapped[str] = mapped_column(String(255))
    evaluation_type: Mapped[EvaluationType] = mapped_column(
        enum_column(EvaluationType), default=EvaluationType.UNKNOWN
    )
    weight_percent: Mapped[Decimal] = mapped_column(Score)
    score_scale: Mapped[Decimal] = mapped_column(Score, default=Decimal("20"))
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class EvaluationSchemeVote(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evaluation_scheme_votes"
    __table_args__ = (
        UniqueConstraint("evaluation_scheme_id", "user_id", name="uq_scheme_vote_user"),
    )

    evaluation_scheme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evaluation_schemes.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    vote: Mapped[SchemeVote] = mapped_column(enum_column(SchemeVote), default=SchemeVote.APPROVE)
    context_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)


class EvaluationSchemeAudit(UUIDMixin, TimestampMixin, Base):
    """Snapshot antes/después de una edición admin de esquema (ERS §8.13)."""

    __tablename__ = "evaluation_scheme_audits"

    evaluation_scheme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evaluation_schemes.id"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    before_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
