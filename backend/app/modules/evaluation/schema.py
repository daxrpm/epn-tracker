"""Schemas (DTOs) for evaluation schemes and community voting (ERS §17.7, §RF-019)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.common.enums import (
    Contribution,
    EvaluationSchemeStatus,
    EvaluationType,
    SchemeVote,
    Visibility,
)


class ComponentIn(BaseModel):
    contribution: Contribution
    name: str
    weight_percent: Decimal = Field(ge=0, le=100)
    evaluation_type: EvaluationType = EvaluationType.UNKNOWN
    score_scale: Decimal = Decimal("20")
    display_order: int = 0


class ComponentOut(BaseModel):
    id: uuid.UUID
    contribution: Contribution
    name: str
    weight_percent: Decimal
    evaluation_type: EvaluationType
    score_scale: Decimal
    display_order: int
    model_config = {"from_attributes": True}


class SchemeCreateIn(BaseModel):
    course_id: uuid.UUID
    academic_period_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    professor_id: uuid.UUID | None = None
    title: str
    visibility: Visibility = Visibility.COMMUNITY
    components: list[ComponentIn]


class SchemeOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    status: EvaluationSchemeStatus
    visibility: Visibility
    approval_count: int
    components: list[ComponentOut]
    model_config = {"from_attributes": True}


class SchemeListItem(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    status: EvaluationSchemeStatus
    approval_count: int
    model_config = {"from_attributes": True}


class VoteIn(BaseModel):
    vote: SchemeVote = SchemeVote.APPROVE


class VoteOut(BaseModel):
    scheme_id: uuid.UUID
    status: EvaluationSchemeStatus
    approval_count: int


class SchemeIssueOut(BaseModel):
    field: str
    message: str


class SchemeCreateOut(BaseModel):
    id: uuid.UUID
    status: EvaluationSchemeStatus
    is_valid: bool
    warnings: list[SchemeIssueOut] = []
