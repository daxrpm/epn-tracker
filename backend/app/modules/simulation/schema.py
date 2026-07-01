"""Schemas (DTOs) for the enrollment simulator (ERS §17.10, §18.3)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from app.common.enums import EnglishLevel


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
