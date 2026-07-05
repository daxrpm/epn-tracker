"""Schemas (DTOs) for professors, offerings and sections (ERS §12.10-12.13)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from app.common.enums import CourseOfferingStatus, Modality, SectionProfessorRole

# --- Professors -----------------------------------------------------------------------------------


class ProfessorOut(BaseModel):
    id: uuid.UUID
    institution_id: uuid.UUID
    full_name: str
    email: str | None
    is_active: bool
    model_config = {"from_attributes": True}


class ProfessorCreateIn(BaseModel):
    institution_id: uuid.UUID
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = None


class ProfessorUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = None
    is_active: bool | None = None


class ProfessorFindOrCreateIn(BaseModel):
    """Lets any authenticated user register a professor while creating a course (ERS §17.7)."""

    course_id: uuid.UUID
    full_name: str = Field(min_length=1, max_length=255)


# --- Course offerings -----------------------------------------------------------------------------


class CourseOfferingOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    academic_period_id: uuid.UUID
    curriculum_id: uuid.UUID | None
    status: CourseOfferingStatus
    model_config = {"from_attributes": True}


class CourseOfferingCreateIn(BaseModel):
    course_id: uuid.UUID
    academic_period_id: uuid.UUID
    curriculum_id: uuid.UUID | None = None


# --- Sections -------------------------------------------------------------------------------------


class SectionOut(BaseModel):
    id: uuid.UUID
    course_offering_id: uuid.UUID
    section_code: str
    modality: Modality
    model_config = {"from_attributes": True}


class SectionCreateIn(BaseModel):
    course_offering_id: uuid.UUID
    section_code: str = Field(min_length=1, max_length=50)
    modality: Modality = Modality.UNKNOWN


# --- Section professors ---------------------------------------------------------------------------


class SectionProfessorOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    professor_id: uuid.UUID
    role: SectionProfessorRole
    model_config = {"from_attributes": True}


class SectionProfessorCreateIn(BaseModel):
    section_id: uuid.UUID
    professor_id: uuid.UUID
    role: SectionProfessorRole = SectionProfessorRole.PRIMARY
