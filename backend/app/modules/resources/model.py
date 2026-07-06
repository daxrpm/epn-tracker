"""Study resource models (recursos).

A ``Resource`` attaches to a *catalog* course (``courses.id``) so it is shared across every
malla that uses that course. Moderation reuses the evaluation pattern: ``Visibility`` +
``ResourceVote`` + ``approval_count``. File-backed resources store an S3/MinIO ``object_key``;
``LINK`` resources store an ``external_url`` instead. ``extracted_text`` is scaffolding for a
future pgvector/AI phase (no embedding column yet — keeps the SQLite test metadata portable).
"""

from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Boolean

from app.common.enums import (
    Contribution,
    ResourceKind,
    ResourceStatus,
    SchemeVote,
    Visibility,
)
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import enum_column


class Resource(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "resources"

    # --- Classification -----------------------------------------------------------------------
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), index=True)
    academic_period_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academic_periods.id"), nullable=True
    )
    professor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("professors.id"), nullable=True, index=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tema: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    contribution: Mapped[Contribution | None] = mapped_column(
        enum_column(Contribution), nullable=True
    )
    kind: Mapped[ResourceKind] = mapped_column(enum_column(ResourceKind))

    # --- Moderation (mirrors EvaluationScheme) ------------------------------------------------
    status: Mapped[ResourceStatus] = mapped_column(
        enum_column(ResourceStatus), default=ResourceStatus.PERSONAL
    )
    visibility: Mapped[Visibility] = mapped_column(
        enum_column(Visibility), default=Visibility.PRIVATE
    )
    approval_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # --- File-backed (null for LINK) ----------------------------------------------------------
    object_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bucket: Mapped[str | None] = mapped_column(String(128), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # --- Link-backed --------------------------------------------------------------------------
    external_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- AI / vectorization (reserved; no logic yet) ------------------------------------------
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_extracted: Mapped[bool] = mapped_column(Boolean, default=False)
    embedding_status: Mapped[str | None] = mapped_column(String(32), nullable=True)


class ResourceVote(UUIDMixin, TimestampMixin, Base):
    """One community vote per user per resource (mirrors ``EvaluationSchemeVote``)."""

    __tablename__ = "resource_votes"
    __table_args__ = (
        UniqueConstraint("resource_id", "user_id", name="uq_resource_vote_user"),
    )

    resource_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    vote: Mapped[SchemeVote] = mapped_column(enum_column(SchemeVote), default=SchemeVote.APPROVE)
