"""Schemas (DTOs) for the academic catalog and curriculum import (ERS §14)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field

from app.common.enums import (
    CurriculumStatus,
    GraduationRequirementType,
    OrganizationUnit,
    RequirementType,
)

# --- Catalog (output) -----------------------------------------------------------------------------


class InstitutionOut(BaseModel):
    id: uuid.UUID
    name: str
    acronym: str
    model_config = {"from_attributes": True}


class FacultyOut(BaseModel):
    id: uuid.UUID
    institution_id: uuid.UUID
    name: str
    acronym: str
    model_config = {"from_attributes": True}


class CareerOut(BaseModel):
    id: uuid.UUID
    faculty_id: uuid.UUID
    name: str
    degree_title: str
    model_config = {"from_attributes": True}


class CurriculumOut(BaseModel):
    id: uuid.UUID
    career_id: uuid.UUID
    name: str
    pensum_year: int
    total_credits: Decimal
    total_hours: int
    total_terms: int
    total_courses_reported: int | None
    status: CurriculumStatus
    model_config = {"from_attributes": True}


class CourseOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    default_credits: Decimal
    model_config = {"from_attributes": True}


class CurriculumCourseOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    code: str
    name: str
    reference_term: int
    credits: Decimal
    hours: int
    organization_unit: OrganizationUnit
    is_required: bool
    prerequisite_codes: list[str] = []
    corequisite_codes: list[str] = []


# --- Academic periods (ERS §12.9) -----------------------------------------------------------------


class AcademicPeriodOut(BaseModel):
    id: uuid.UUID
    institution_id: uuid.UUID
    code: str
    name: str
    starts_on: str | None
    ends_on: str | None
    is_current: bool
    model_config = {"from_attributes": True}


class AcademicPeriodCreateIn(BaseModel):
    institution_id: uuid.UUID
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=255)
    starts_on: str | None = None
    ends_on: str | None = None
    is_current: bool = False


class AcademicPeriodUpdateIn(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    starts_on: str | None = None
    ends_on: str | None = None
    is_current: bool | None = None


# --- Curriculum import (input, ERS §14.2) ---------------------------------------------------------


class ImportInstitution(BaseModel):
    name: str
    acronym: str


class ImportFaculty(BaseModel):
    name: str
    acronym: str


class ImportCareer(BaseModel):
    name: str
    degree_title: str
    code: str | None = None


class ImportCurriculum(BaseModel):
    pensum_year: int
    total_terms: int = 9
    total_credits: Decimal
    total_hours: int = 0
    total_courses_reported: int | None = None


class ImportRequirement(BaseModel):
    type: RequirementType
    course_code: str


class ImportCourse(BaseModel):
    code: str
    name: str
    credits: Decimal
    hours: int = 0
    reference_term: int
    organization_unit: OrganizationUnit = OrganizationUnit.OTHER
    is_required: bool = True
    requirements: list[ImportRequirement] = Field(default_factory=list)


class ImportGraduationRequirement(BaseModel):
    code: str
    name: str
    type: GraduationRequirementType


class CurriculumImportIn(BaseModel):
    institution: ImportInstitution
    faculty: ImportFaculty
    career: ImportCareer
    curriculum: ImportCurriculum
    courses: list[ImportCourse]
    graduation_requirements: list[ImportGraduationRequirement] = Field(default_factory=list)
    allow_credit_mismatch: bool = False


# --- Validation result (ERS §14.4) ----------------------------------------------------------------


class ImportIssue(BaseModel):
    path: str
    message: str


class ImportValidationOut(BaseModel):
    valid: bool
    errors: list[ImportIssue] = []
    warnings: list[ImportIssue] = []


class ImportCommitOut(BaseModel):
    curriculum_id: uuid.UUID
    courses_created: int
    validation: ImportValidationOut
