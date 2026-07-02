"""Offering services: professors, offerings, sections (ERS §12.10-12.13).

Data access is delegated to the crud layer; this module holds the business rules and validations.
User-facing messages stay in Spanish (product locale).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exception.errors import ConflictError, NotFoundError
from app.modules.academic import crud as academic_crud
from app.modules.academic.model import AcademicPeriod, Course, Institution
from app.modules.offering import crud
from app.modules.offering.model import (
    CourseOffering,
    Professor,
    Section,
    SectionProfessor,
)
from app.modules.offering.schema import (
    CourseOfferingCreateIn,
    ProfessorCreateIn,
    ProfessorFindOrCreateIn,
    SectionCreateIn,
    SectionProfessorCreateIn,
)


async def create_professor(db: AsyncSession, payload: ProfessorCreateIn) -> Professor:
    if await db.get(Institution, payload.institution_id) is None:
        raise NotFoundError("Institución no encontrada.")
    professor = Professor(
        institution_id=payload.institution_id,
        full_name=payload.full_name,
        email=payload.email,
    )
    db.add(professor)
    await db.flush()
    return professor


async def find_or_create_professor(
    db: AsyncSession, payload: ProfessorFindOrCreateIn
) -> Professor:
    """Any authenticated user can register a professor while creating a course scheme.

    Scoped to the course's institution and de-duplicated by name so students typing
    "Enrique Mafla" twice reuse the same professor instead of creating near-duplicates.
    """
    course = await db.get(Course, payload.course_id)
    if course is None:
        raise NotFoundError("Materia no encontrada.")
    existing = await crud.get_professor_by_name(db, course.institution_id, payload.full_name)
    if existing is not None:
        return existing
    professor = Professor(institution_id=course.institution_id, full_name=payload.full_name.strip())
    db.add(professor)
    await db.flush()
    return professor


async def create_course_offering(
    db: AsyncSession, payload: CourseOfferingCreateIn
) -> CourseOffering:
    if await db.get(Course, payload.course_id) is None:
        raise NotFoundError("Materia no encontrada.")
    if await db.get(AcademicPeriod, payload.academic_period_id) is None:
        raise NotFoundError("Periodo académico no encontrado.")
    if (
        payload.curriculum_id is not None
        and await academic_crud.get_curriculum(db, payload.curriculum_id) is None
    ):
        raise NotFoundError("Malla no encontrada.")

    offering = CourseOffering(
        course_id=payload.course_id,
        academic_period_id=payload.academic_period_id,
        curriculum_id=payload.curriculum_id,
    )
    db.add(offering)
    await db.flush()
    return offering


async def create_section(db: AsyncSession, payload: SectionCreateIn) -> Section:
    if await crud.get_course_offering(db, payload.course_offering_id) is None:
        raise NotFoundError("Oferta de materia no encontrada.")
    section = Section(
        course_offering_id=payload.course_offering_id,
        section_code=payload.section_code,
        modality=payload.modality,
    )
    db.add(section)
    await db.flush()
    return section


async def create_section_professor(
    db: AsyncSession, payload: SectionProfessorCreateIn
) -> SectionProfessor:
    if await crud.get_section(db, payload.section_id) is None:
        raise NotFoundError("Paralelo no encontrado.")
    if await crud.get_professor(db, payload.professor_id) is None:
        raise NotFoundError("Docente no encontrado.")
    existing = await crud.get_section_professor(
        db, payload.section_id, payload.professor_id
    )
    if existing is not None:
        raise ConflictError("El docente ya está asignado a este paralelo.")

    link = SectionProfessor(
        section_id=payload.section_id,
        professor_id=payload.professor_id,
        role=payload.role,
    )
    db.add(link)
    await db.flush()
    return link
