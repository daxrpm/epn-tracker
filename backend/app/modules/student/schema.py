"""Schemas (DTOs) for the student profile, course states and gradebook (ERS §17.5, §17.6)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.common.enums import (
    Contribution,
    CourseFinalStatus,
    CourseState,
    EnglishLevel,
    GradeComponentMode,
    GraduationRequirementState,
    GraduationRequirementType,
)

# --- Profile --------------------------------------------------------------------------------------


class ProfileOut(BaseModel):
    id: uuid.UUID
    display_name: str | None
    current_curriculum_id: uuid.UUID | None
    english_level: EnglishLevel
    english_sufficiency: bool
    model_config = {"from_attributes": True}


class ProfileUpdateIn(BaseModel):
    display_name: str | None = None
    current_curriculum_id: uuid.UUID | None = None
    english_level: EnglishLevel | None = None
    english_sufficiency: bool | None = None
    english_last_required_level_enrolled: bool | None = None
    has_english_exception_authorization: bool | None = None


# --- Course states --------------------------------------------------------------------------------


class CourseStateOut(BaseModel):
    id: uuid.UUID
    curriculum_course_id: uuid.UUID
    state: CourseState
    final_score_40: Decimal | None
    model_config = {"from_attributes": True}


class CourseStateItemIn(BaseModel):
    curriculum_course_id: uuid.UUID
    state: CourseState
    final_score_40: Decimal | None = None


class CourseStateBulkIn(BaseModel):
    items: list[CourseStateItemIn]


# --- Graduation requirements ----------------------------------------------------------------------


class GradReqStateOut(BaseModel):
    id: uuid.UUID
    graduation_requirement_id: uuid.UUID
    code: str
    name: str
    requirement_type: GraduationRequirementType
    state: GraduationRequirementState
    model_config = {"from_attributes": True}


class GradReqStateUpdateIn(BaseModel):
    state: GraduationRequirementState


# --- Enrollments and gradebook --------------------------------------------------------------------


class EnrollmentCreateIn(BaseModel):
    curriculum_course_id: uuid.UUID
    academic_period_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    professor_id: uuid.UUID | None = None
    evaluation_scheme_id: uuid.UUID


class EnrollmentOut(BaseModel):
    id: uuid.UUID
    curriculum_course_id: uuid.UUID
    evaluation_scheme_id: uuid.UUID | None
    model_config = {"from_attributes": True}


class GradeItemOut(BaseModel):
    id: uuid.UUID
    name: str
    score: Decimal | None
    internal_weight_percent: Decimal | None
    model_config = {"from_attributes": True}


class ComponentStateOut(BaseModel):
    id: uuid.UUID
    evaluation_component_id: uuid.UUID
    name: str
    contribution: Contribution
    weight_percent: Decimal
    mode: GradeComponentMode
    direct_score: Decimal | None
    calculated_score: Decimal | None
    items: list[GradeItemOut]


class GradebookOut(BaseModel):
    enrollment_id: uuid.UUID
    components: list[ComponentStateOut]


class ComponentPatchIn(BaseModel):
    mode: GradeComponentMode | None = None
    direct_score: Decimal | None = None


class ItemCreateIn(BaseModel):
    name: str
    score: Decimal | None = None
    internal_weight_percent: Decimal | None = None


class ItemPatchIn(BaseModel):
    name: str | None = None
    score: Decimal | None = None
    internal_weight_percent: Decimal | None = None


# --- Malla progress -------------------------------------------------------------------------------


class ProgressTermOut(BaseModel):
    term: int
    approved_credits: str
    total_credits: str


class ProgressOut(BaseModel):
    total_credits: str
    approved_credits: str
    percent: str
    counts_by_state: dict[str, int]
    by_term: list[ProgressTermOut]


# --- Calculation result ---------------------------------------------------------------------------


class ContributionOut(BaseModel):
    contribution: Contribution
    score_20: str
    evaluated_weight_percent: str
    is_complete: bool


class CalculateOut(BaseModel):
    aporte_1: ContributionOut
    aporte_2: ContributionOut
    final_40: str
    final_20: str
    display_final_20: str
    status: CourseFinalStatus
    is_complete: bool
    required_recovery_score_40: str | None = Field(default=None)


# --- Projection (RF-009) --------------------------------------------------------------------------


class ProjectionOut(BaseModel):
    target_final_40: str
    current_points_40: str
    evaluated_weight_percent: str
    remaining_weight_percent: str
    required_avg_score_20: str | None = Field(default=None)
    already_reached: bool
    is_reachable: bool
