"""Schemas (DTOs) for the enrollment simulator (ERS §17.10, §18.3)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.common.enums import CourseState, EnglishLevel


class EnglishStateIn(BaseModel):
    level: EnglishLevel = EnglishLevel.NONE
    sufficiency: bool = False
    last_required_level_enrolled: bool = False
    has_exception_authorization: bool = False


class SimulationRunIn(BaseModel):
    curriculum_id: uuid.UUID
    passed_course_codes: list[str] = Field(default_factory=list)
    failed_course_codes: list[str] = Field(default_factory=list)
    annulled_course_codes: list[str] = Field(default_factory=list)
    selected_course_codes: list[str] = Field(default_factory=list)
    english: EnglishStateIn = Field(default_factory=EnglishStateIn)
    has_special_credit_authorization: bool = False


class ReasonOut(BaseModel):
    code: str
    message: str


class CourseNodeOut(BaseModel):
    code: str
    name: str
    credits: str


class BlockedCourseOut(BaseModel):
    code: str
    name: str
    reasons: list[ReasonOut]


class SimulationRunOut(BaseModel):
    max_credits: str
    selected_credits: str
    selected_valid: bool
    eligible_courses: list[CourseNodeOut]
    blocked_courses: list[BlockedCourseOut]
    restriction_reasons: list[ReasonOut]


# --- Authenticated student simulator (seeds the scenario from stored state) ----------------------


class AssumptionIn(BaseModel):
    """A projected outcome the student sets for a course (overrides the stored state)."""

    curriculum_course_id: uuid.UUID
    state: CourseState


class StudentSimulationRunIn(BaseModel):
    """Only the assumptions and next-term selection travel over the wire; the base scenario
    (approved/current courses) and the English state come from the student's saved profile."""

    assumptions: list[AssumptionIn] = Field(default_factory=list)
    selected_course_ids: list[uuid.UUID] = Field(default_factory=list)
    has_special_credit_authorization: bool = False
    # When omitted, the English state is read from the student's profile.
    english_override: EnglishStateIn | None = None


class StudentCourseNodeOut(CourseNodeOut):
    curriculum_course_id: uuid.UUID | None = None
    reference_term: int | None = None


class StudentBlockedCourseOut(BlockedCourseOut):
    curriculum_course_id: uuid.UUID | None = None
    reference_term: int | None = None


class StudentSimulationRunOut(BaseModel):
    max_credits: str
    selected_credits: str
    selected_valid: bool
    eligible_courses: list[StudentCourseNodeOut]
    blocked_courses: list[StudentBlockedCourseOut]
    restriction_reasons: list[ReasonOut]


# --- Saved scenarios (ERS §12.24, §17.10) --------------------------------------------------------


class SavedSimulationCreateIn(StudentSimulationRunIn):
    name: str = Field(min_length=1, max_length=255)


class SavedSimulationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    curriculum_id: uuid.UUID
    created_at: datetime
    input_snapshot: dict
    result: StudentSimulationRunOut


class SavedSimulationListItem(BaseModel):
    id: uuid.UUID
    name: str
    curriculum_id: uuid.UUID
    created_at: datetime
    max_credits: str
    selected_credits: str
    selected_valid: bool
