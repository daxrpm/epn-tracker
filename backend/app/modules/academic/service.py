"""Academic catalog services and curriculum import (ERS §RF-016, §14).

Import validation is pure (operates on the payload); commit persists using the same validation so
the two never diverge. User-facing messages are kept in Spanish (product locale).
"""

from __future__ import annotations

import unicodedata
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import CurriculumStatus
from app.common.exception.errors import ValidationAppError
from app.modules.academic.model import (
    Career,
    Course,
    CourseRequirement,
    Curriculum,
    CurriculumCourse,
    CurriculumGraduationRequirement,
    Faculty,
    GraduationRequirement,
    Institution,
)
from app.modules.academic.schema import (
    CurriculumImportIn,
    ImportCommitOut,
    ImportGraduationRequirement,
    ImportIssue,
    ImportValidationOut,
)

_CREDIT_TOLERANCE = Decimal("0.001")


def normalize_name(name: str) -> str:
    """Return an accent-free, lowercased name for case-insensitive search."""
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return text.strip().lower()


def validate_import(payload: CurriculumImportIn) -> ImportValidationOut:
    """Validate a curriculum payload without persisting anything (ERS §14.3/§14.4)."""
    errors: list[ImportIssue] = []
    warnings: list[ImportIssue] = []

    codes = [c.code for c in payload.courses]
    seen: set[str] = set()
    for idx, code in enumerate(codes):
        if code in seen:
            errors.append(
                ImportIssue(path=f"courses[{idx}].code", message=f"Código duplicado: {code}.")
            )
        seen.add(code)

    code_set = set(codes)
    total_credits = Decimal("0")
    for idx, course in enumerate(payload.courses):
        if course.credits < 0:
            errors.append(
                ImportIssue(
                    path=f"courses[{idx}].credits",
                    message="Los créditos no pueden ser negativos.",
                )
            )
        total_credits += course.credits

        if not 1 <= course.reference_term <= payload.curriculum.total_terms:
            errors.append(
                ImportIssue(
                    path=f"courses[{idx}].reference_term",
                    message=(
                        f"El periodo referencial debe estar entre 1 y "
                        f"{payload.curriculum.total_terms}."
                    ),
                )
            )

        for r_idx, req in enumerate(course.requirements):
            if req.course_code not in code_set:
                errors.append(
                    ImportIssue(
                        path=f"courses[{idx}].requirements[{r_idx}].course_code",
                        message=f"El requisito {req.course_code} no existe en la malla.",
                    )
                )

    if abs(total_credits - payload.curriculum.total_credits) > _CREDIT_TOLERANCE:
        issue = ImportIssue(
            path="curriculum.total_credits",
            message=(
                f"La suma de créditos ({total_credits}) no coincide con el total declarado "
                f"({payload.curriculum.total_credits})."
            ),
        )
        (warnings if payload.allow_credit_mismatch else errors).append(issue)

    reported = payload.curriculum.total_courses_reported
    if reported is not None and reported != len(payload.courses):
        warnings.append(
            ImportIssue(
                path="curriculum.total_courses_reported",
                message=(
                    f"Se reportaron {reported} materias pero se cargaron "
                    f"{len(payload.courses)}."
                ),
            )
        )

    return ImportValidationOut(valid=not errors, errors=errors, warnings=warnings)


async def commit_import(db: AsyncSession, payload: CurriculumImportIn) -> ImportCommitOut:
    """Validate and persist a full curriculum (ERS §RF-016)."""
    validation = validate_import(payload)
    if not validation.valid:
        raise ValidationAppError(
            "La malla no es válida.",
            details=[{"field": e.path, "message": e.message} for e in validation.errors],
        )

    institution = await _get_or_create_institution(
        db, payload.institution.name, payload.institution.acronym
    )
    faculty = await _get_or_create_faculty(
        db, institution.id, payload.faculty.name, payload.faculty.acronym
    )
    career = await _get_or_create_career(
        db, faculty.id, payload.career.name, payload.career.degree_title, payload.career.code
    )
    await _ensure_curriculum_is_new(db, career.id, payload.curriculum.pensum_year)

    curriculum = Curriculum(
        career_id=career.id,
        name=f"Pénsum {payload.curriculum.pensum_year}",
        pensum_year=payload.curriculum.pensum_year,
        total_credits=payload.curriculum.total_credits,
        total_hours=payload.curriculum.total_hours,
        total_terms=payload.curriculum.total_terms,
        total_courses_reported=payload.curriculum.total_courses_reported,
        status=CurriculumStatus.ACTIVE,
    )
    db.add(curriculum)
    await db.flush()

    code_to_cc = await _create_curriculum_courses(db, curriculum, institution.id, payload)
    _link_requirements(db, code_to_cc, payload)
    await _link_graduation_requirements(db, curriculum, institution.id, payload)

    await db.flush()
    return ImportCommitOut(
        curriculum_id=curriculum.id,
        courses_created=len(payload.courses),
        validation=validation,
    )


async def _create_curriculum_courses(
    db: AsyncSession,
    curriculum: Curriculum,
    institution_id: uuid.UUID,
    payload: CurriculumImportIn,
) -> dict[str, CurriculumCourse]:
    code_to_cc: dict[str, CurriculumCourse] = {}
    for order, course_in in enumerate(payload.courses):
        course = await _get_or_create_course(
            db, institution_id, course_in.code, course_in.name, course_in.credits, course_in.hours
        )
        cc = CurriculumCourse(
            curriculum_id=curriculum.id,
            course_id=course.id,
            reference_term=course_in.reference_term,
            credits=course_in.credits,
            hours=course_in.hours,
            organization_unit=course_in.organization_unit,
            is_required=course_in.is_required,
            display_order=order,
        )
        db.add(cc)
        await db.flush()
        code_to_cc[course_in.code] = cc
    return code_to_cc


def _link_requirements(
    db: AsyncSession,
    code_to_cc: dict[str, CurriculumCourse],
    payload: CurriculumImportIn,
) -> None:
    for course_in in payload.courses:
        target = code_to_cc[course_in.code]
        for req in course_in.requirements:
            required = code_to_cc[req.course_code]
            db.add(
                CourseRequirement(
                    curriculum_course_id=target.id,
                    required_curriculum_course_id=required.id,
                    requirement_type=req.type,
                )
            )


async def _link_graduation_requirements(
    db: AsyncSession,
    curriculum: Curriculum,
    institution_id: uuid.UUID,
    payload: CurriculumImportIn,
) -> None:
    for grad_in in payload.graduation_requirements:
        grad = await _get_or_create_graduation_requirement(db, institution_id, grad_in)
        db.add(
            CurriculumGraduationRequirement(
                curriculum_id=curriculum.id, graduation_requirement_id=grad.id
            )
        )


# --- get-or-create helpers ------------------------------------------------------------------------


async def _get_or_create_institution(db: AsyncSession, name: str, acronym: str) -> Institution:
    result = await db.execute(select(Institution).where(Institution.acronym == acronym))
    inst = result.scalar_one_or_none()
    if inst is None:
        inst = Institution(name=name, acronym=acronym)
        db.add(inst)
        await db.flush()
    return inst


async def _get_or_create_faculty(
    db: AsyncSession, institution_id: uuid.UUID, name: str, acronym: str
) -> Faculty:
    result = await db.execute(
        select(Faculty).where(
            Faculty.institution_id == institution_id, Faculty.acronym == acronym
        )
    )
    fac = result.scalar_one_or_none()
    if fac is None:
        fac = Faculty(institution_id=institution_id, name=name, acronym=acronym)
        db.add(fac)
        await db.flush()
    return fac


async def _get_or_create_career(
    db: AsyncSession, faculty_id: uuid.UUID, name: str, degree_title: str, code: str | None
) -> Career:
    result = await db.execute(
        select(Career).where(Career.faculty_id == faculty_id, Career.name == name)
    )
    career = result.scalar_one_or_none()
    if career is None:
        career = Career(faculty_id=faculty_id, name=name, degree_title=degree_title, code=code)
        db.add(career)
        await db.flush()
    return career


async def _get_or_create_course(
    db: AsyncSession,
    institution_id: uuid.UUID,
    code: str,
    name: str,
    credits: Decimal,
    hours: int,
) -> Course:
    result = await db.execute(
        select(Course).where(Course.institution_id == institution_id, Course.code == code)
    )
    course = result.scalar_one_or_none()
    if course is None:
        course = Course(
            institution_id=institution_id,
            code=code,
            name=name,
            normalized_name=normalize_name(name),
            default_credits=credits,
            default_hours=hours,
        )
        db.add(course)
        await db.flush()
    return course


async def _get_or_create_graduation_requirement(
    db: AsyncSession, institution_id: uuid.UUID, grad_in: ImportGraduationRequirement
) -> GraduationRequirement:
    result = await db.execute(
        select(GraduationRequirement).where(
            GraduationRequirement.institution_id == institution_id,
            GraduationRequirement.code == grad_in.code,
        )
    )
    grad = result.scalar_one_or_none()
    if grad is None:
        grad = GraduationRequirement(
            institution_id=institution_id,
            code=grad_in.code,
            name=grad_in.name,
            requirement_type=grad_in.type,
        )
        db.add(grad)
        await db.flush()
    return grad


async def _ensure_curriculum_is_new(
    db: AsyncSession, career_id: uuid.UUID, pensum_year: int
) -> None:
    existing = await db.execute(
        select(Curriculum).where(
            Curriculum.career_id == career_id, Curriculum.pensum_year == pensum_year
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValidationAppError(f"Ya existe un pénsum {pensum_year} para esta carrera.")
