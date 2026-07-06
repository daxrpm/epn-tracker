"""Domain enums for the EPN Notas Mallas system.

Single source of truth for every state and category (see ERS §27 and §12). These enums do not depend
on any framework; they are re-exported from ``app.common.enums`` for the rest of the application.
"""

from __future__ import annotations

from enum import StrEnum

# --- Identity and access --------------------------------------------------------------------------


class UserRole(StrEnum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DELETED = "DELETED"


# --- Academic catalog -----------------------------------------------------------------------------


class CurriculumStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class CourseType(StrEnum):
    REGULAR = "REGULAR"
    NON_CREDIT = "NON_CREDIT"
    PRACTICE = "PRACTICE"
    CAPSTONE = "CAPSTONE"
    GRADUATION_REQUIREMENT = "GRADUATION_REQUIREMENT"


class OrganizationUnit(StrEnum):
    BASIC = "BASIC"
    PROFESSIONAL = "PROFESSIONAL"
    CAPSTONE = "CAPSTONE"
    OTHER = "OTHER"


class RequirementType(StrEnum):
    PREREQUISITE = "PREREQUISITE"
    COREQUISITE = "COREQUISITE"


class RuleOperator(StrEnum):
    ALL = "ALL"
    ANY = "ANY"


class GraduationRequirementType(StrEnum):
    ENGLISH = "ENGLISH"
    SPORTS = "SPORTS"
    CLUBS = "CLUBS"
    SOCIAL = "SOCIAL"
    ENTREPRENEURSHIP = "ENTREPRENEURSHIP"
    ENVIRONMENT = "ENVIRONMENT"
    PROJECTS = "PROJECTS"
    OTHER = "OTHER"


# --- Offering -------------------------------------------------------------------------------------


class CourseOfferingStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class Modality(StrEnum):
    PRESENTIAL = "PRESENTIAL"
    ONLINE = "ONLINE"
    HYBRID = "HYBRID"
    UNKNOWN = "UNKNOWN"


class SectionProfessorRole(StrEnum):
    PRIMARY = "PRIMARY"
    ASSISTANT = "ASSISTANT"
    COMPONENT_AC = "COMPONENT_AC"
    COMPONENT_AP = "COMPONENT_AP"
    OTHER = "OTHER"


# --- Evaluation -----------------------------------------------------------------------------------


class Contribution(StrEnum):
    APORTE_1 = "APORTE_1"
    APORTE_2 = "APORTE_2"


class EvaluationType(StrEnum):
    FORMATIVE = "FORMATIVE"
    SUMMATIVE = "SUMMATIVE"
    UNKNOWN = "UNKNOWN"


class EvaluationSchemeStatus(StrEnum):
    PERSONAL = "PERSONAL"
    COMMUNITY_PENDING = "COMMUNITY_PENDING"
    COMMUNITY_VERIFIED = "COMMUNITY_VERIFIED"
    ADMIN_VERIFIED = "ADMIN_VERIFIED"
    ARCHIVED = "ARCHIVED"


class Visibility(StrEnum):
    PRIVATE = "PRIVATE"
    COMMUNITY = "COMMUNITY"
    PUBLIC = "PUBLIC"


class SchemeSourceType(StrEnum):
    MANUAL_STUDENT = "MANUAL_STUDENT"
    MANUAL_ADMIN = "MANUAL_ADMIN"
    SYLLABUS_AI = "SYLLABUS_AI"
    SYLLABUS_MANUAL = "SYLLABUS_MANUAL"


class SchemeVote(StrEnum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


# --- Student grades -------------------------------------------------------------------------------


class GradeComponentMode(StrEnum):
    DIRECT_SCORE = "DIRECT_SCORE"
    EQUAL_AVERAGE = "EQUAL_AVERAGE"
    CUSTOM_WEIGHTS = "CUSTOM_WEIGHTS"


class CourseState(StrEnum):
    """State the student assigns to a course within their curriculum."""

    NOT_TAKEN = "NOT_TAKEN"
    IN_PROGRESS = "IN_PROGRESS"
    PASSED = "PASSED"
    FAILED = "FAILED"
    ANNULLED = "ANNULLED"


class CourseStateSource(StrEnum):
    MANUAL = "MANUAL"
    GRADEBOOK = "GRADEBOOK"
    SIMULATION = "SIMULATION"


class EnrollmentState(StrEnum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ANNULLED = "ANNULLED"


class GraduationRequirementState(StrEnum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


# --- Calculation results (domain) -----------------------------------------------------------------


class CourseFinalStatus(StrEnum):
    """Result of the ordinary final-grade calculation (ERS §8.4)."""

    APPROVED = "APPROVED"
    RECOVERY_ELIGIBLE = "RECOVERY_ELIGIBLE"
    FAILED_DIRECT = "FAILED_DIRECT"
    IN_PROGRESS = "IN_PROGRESS"


class CalculationMode(StrEnum):
    """How grades are treated during calculation (ERS §8.7)."""

    CURRENT = "CURRENT"
    PROJECTION = "PROJECTION"
    FINALIZED = "FINALIZED"


class MissingPolicy(StrEnum):
    IGNORE = "IGNORE"
    ZERO = "ZERO"
    USER_ASSUMPTION = "USER_ASSUMPTION"


# --- English (ordered by level) -------------------------------------------------------------------


class EnglishLevel(StrEnum):
    NONE = "NONE"
    BASIC_1 = "BASIC_1"
    BASIC_2 = "BASIC_2"
    INTERMEDIATE_1 = "INTERMEDIATE_1"
    ADVANCED_1 = "ADVANCED_1"
    ADVANCED_2 = "ADVANCED_2"
    SUFFICIENCY_B1 = "SUFFICIENCY_B1"

    @property
    def rank(self) -> int:
        """Ordinal index used to compare English levels reliably."""
        return _ENGLISH_LEVEL_ORDER.index(self)

    def __lt__(self, other: object) -> bool:  # type: ignore[override]
        if isinstance(other, EnglishLevel):
            return self.rank < other.rank
        return NotImplemented


_ENGLISH_LEVEL_ORDER: list[EnglishLevel] = [
    EnglishLevel.NONE,
    EnglishLevel.BASIC_1,
    EnglishLevel.BASIC_2,
    EnglishLevel.INTERMEDIATE_1,
    EnglishLevel.ADVANCED_1,
    EnglishLevel.ADVANCED_2,
    EnglishLevel.SUFFICIENCY_B1,
]


# --- Simulation -----------------------------------------------------------------------------------


class SimulationMode(StrEnum):
    ANONYMOUS = "ANONYMOUS"
    SAVED = "SAVED"


# --- Syllabi / AI jobs (reserved for Phase 5) -----------------------------------------------------


class SyllabusJobStatus(StrEnum):
    UPLOADED = "UPLOADED"
    TEXT_EXTRACTED = "TEXT_EXTRACTED"
    EXTRACTION_RUNNING = "EXTRACTION_RUNNING"
    EXTRACTED = "EXTRACTED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    NEEDS_ADMIN_REVIEW = "NEEDS_ADMIN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


# --- Study resources (recursos) -------------------------------------------------------------------


class ResourceKind(StrEnum):
    """How the frontend renders a resource."""

    PDF = "PDF"
    IMAGE = "IMAGE"
    MARKDOWN = "MARKDOWN"
    TEXT = "TEXT"  # .txt / code / plain text
    OFFICE = "OFFICE"  # docx/pptx/xlsx — download only, no inline preview
    LINK = "LINK"  # external Drive/YouTube/URL


class ResourceStatus(StrEnum):
    """Moderation lifecycle, mirrors ``EvaluationSchemeStatus`` (ERS §RF-019)."""

    PERSONAL = "PERSONAL"
    COMMUNITY_PENDING = "COMMUNITY_PENDING"
    COMMUNITY_VERIFIED = "COMMUNITY_VERIFIED"
    ADMIN_VERIFIED = "ADMIN_VERIFIED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"
