"""Modelo de simulación guardada (ERS §12.24)."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.common.enums import SimulationMode
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import enum_column


class Simulation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "simulations"

    student_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("student_profiles.id"), nullable=True
    )
    curriculum_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("curricula.id"))
    name: Mapped[str] = mapped_column(String(255))
    mode: Mapped[SimulationMode] = mapped_column(
        enum_column(SimulationMode), default=SimulationMode.SAVED
    )
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    result_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
