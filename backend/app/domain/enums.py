"""Enums de dominio del sistema EPN Notas Mallas.

Fuente de verdad para todos los estados y categorías (ver ERS §27 y §12). Estos enums no dependen de
ningún framework; se reexportan desde ``app.common.enums`` para el resto de la aplicación.
"""

from __future__ import annotations

from enum import StrEnum

# --- Identidad y acceso ---------------------------------------------------------------------------


class UserRole(StrEnum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DELETED = "DELETED"


# --- Catálogo académico ---------------------------------------------------------------------------


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


# --- Oferta ---------------------------------------------------------------------------------------


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


# --- Evaluación -----------------------------------------------------------------------------------


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


# --- Notas del estudiante -------------------------------------------------------------------------


class GradeComponentMode(StrEnum):
    DIRECT_SCORE = "DIRECT_SCORE"
    EQUAL_AVERAGE = "EQUAL_AVERAGE"
    CUSTOM_WEIGHTS = "CUSTOM_WEIGHTS"


class CourseState(StrEnum):
    """Estado que el estudiante asigna a una materia dentro de su malla."""

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


# --- Resultados de cálculo (dominio) --------------------------------------------------------------


class CourseFinalStatus(StrEnum):
    """Resultado del cálculo de la nota final ordinaria (ERS §8.4)."""

    APPROVED = "APPROVED"
    RECOVERY_ELIGIBLE = "RECOVERY_ELIGIBLE"
    FAILED_DIRECT = "FAILED_DIRECT"
    IN_PROGRESS = "IN_PROGRESS"


class CalculationMode(StrEnum):
    """Cómo se tratan las notas al calcular (ERS §8.7)."""

    CURRENT = "CURRENT"
    PROJECTION = "PROJECTION"
    FINALIZED = "FINALIZED"


class MissingPolicy(StrEnum):
    IGNORE = "IGNORE"
    ZERO = "ZERO"
    USER_ASSUMPTION = "USER_ASSUMPTION"


# --- Inglés (ordenado por nivel) ------------------------------------------------------------------


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
        """Índice ordinal para comparar niveles de inglés de forma fiable."""
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


# --- Simulación -----------------------------------------------------------------------------------


class SimulationMode(StrEnum):
    ANONYMOUS = "ANONYMOUS"
    SAVED = "SAVED"


# --- Sílabos / trabajos IA (reservado para Fase 5) ------------------------------------------------


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
