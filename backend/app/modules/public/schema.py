"""Schemas for the anonymous calculators (ERS §17.11, §18.1)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field

from app.common.enums import Contribution, CourseFinalStatus, EvaluationType


class AportesIn(BaseModel):
    aporte_1: Decimal = Field(ge=0, le=20)
    aporte_2: Decimal = Field(ge=0, le=20)


class FinalGradeOut(BaseModel):
    final_40: str
    final_20: str
    display_final_20: str
    status: CourseFinalStatus
    is_recovery_eligible: bool
    required_recovery_score_40: str | None
    display_required_recovery_score_40: str | None


class RecoveryOut(BaseModel):
    final_40: str
    final_20: str
    display_final_20: str
    status: CourseFinalStatus
    required_recovery_score_40: str | None
    display_required_recovery_score_40: str | None


class AnonComponentIn(BaseModel):
    contribution: Contribution
    name: str
    weight_percent: Decimal
    evaluation_type: EvaluationType = EvaluationType.UNKNOWN
    score: Decimal | None = None


class AnonSchemeIn(BaseModel):
    components: list[AnonComponentIn]


class AnonSchemeOut(BaseModel):
    aporte_1_score_20: str
    aporte_2_score_20: str
    final_40: str
    final_20: str
    display_final_20: str
    status: CourseFinalStatus
    is_valid: bool
    warnings: list[str]
