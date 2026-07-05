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
from app.common.exception.errors import ConflictError, NotFoundError, ValidationAppError
from app.modules.academic import crud
from app.modules.academic.model import (
    AcademicPeriod,
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
    AcademicPeriodCreateIn,
    AcademicPeriodUpdateIn,
    CareerUpdateIn,
    CourseUpdateIn,
    CurriculumCourseUpdateIn,
    CurriculumImportIn,
    ImportCommitOut,
    ImportGraduationRequirement,
    ImportIssue,
    ImportValidationOut,
    RequirementCreateIn,
)
from app.modules.audit import crud as audit_crud

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


# --- Academic periods (ERS §12.9) -----------------------------------------------------------------


async def create_academic_period(
    db: AsyncSession, payload: AcademicPeriodCreateIn
) -> AcademicPeriod:
    """Create a real academic period; codes are unique per institution."""
    if await db.get(Institution, payload.institution_id) is None:
        raise NotFoundError("Institución no encontrada.")
    existing = await crud.get_academic_period_by_code(
        db, payload.institution_id, payload.code
    )
    if existing is not None:
        raise ConflictError(f"Ya existe un periodo con el código {payload.code}.")

    period = AcademicPeriod(
        institution_id=payload.institution_id,
        code=payload.code,
        name=payload.name,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        is_current=payload.is_current,
    )
    db.add(period)
    await db.flush()
    if period.is_current:
        await _unset_other_current_periods(db, period)
    return period


async def update_academic_period(
    db: AsyncSession, period_id: uuid.UUID, payload: AcademicPeriodUpdateIn
) -> AcademicPeriod:
    period = await crud.get_academic_period(db, period_id)
    if period is None:
        raise NotFoundError("Periodo académico no encontrado.")

    data = payload.model_dump(exclude_unset=True)
    new_code = data.get("code")
    if new_code is not None and new_code != period.code:
        clash = await crud.get_academic_period_by_code(
            db, period.institution_id, new_code
        )
        if clash is not None:
            raise ConflictError(f"Ya existe un periodo con el código {new_code}.")

    for field, value in data.items():
        setattr(period, field, value)
    await db.flush()
    if period.is_current:
        await _unset_other_current_periods(db, period)
    return period


async def _unset_other_current_periods(db: AsyncSession, period: AcademicPeriod) -> None:
    """Only one period per institution may be flagged as current."""
    others = await db.execute(
        select(AcademicPeriod).where(
            AcademicPeriod.institution_id == period.institution_id,
            AcademicPeriod.id != period.id,
            AcademicPeriod.is_current.is_(True),
        )
    )
    for other in others.scalars().all():
        other.is_current = False
    await db.flush()


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


# --- Admin content editing (ERS §17.3): direct edits by admins, each audited ---


async def update_career(
    db: AsyncSession, actor_id: uuid.UUID, career_id: uuid.UUID, payload: CareerUpdateIn
) -> Career:
    career = await crud.get_career(db, career_id)
    if career is None:
        raise NotFoundError("Carrera no encontrada.")
    before = {"name": career.name, "degree_title": career.degree_title}
    if payload.name is not None:
        career.name = payload.name
    if payload.degree_title is not None:
        career.degree_title = payload.degree_title
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor_id,
        action="CAREER_UPDATE",
        entity_type="career",
        entity_id=str(career.id),
        before=before,
        after={"name": career.name, "degree_title": career.degree_title},
    )
    return career


async def update_course(
    db: AsyncSession, actor_id: uuid.UUID, course_id: uuid.UUID, payload: CourseUpdateIn
) -> Course:
    course = await crud.get_course(db, course_id)
    if course is None:
        raise NotFoundError("Materia no encontrada.")
    before = {"name": course.name, "default_credits": str(course.default_credits)}
    if payload.name is not None:
        course.name = payload.name
        course.normalized_name = normalize_name(payload.name)
    if payload.default_credits is not None:
        course.default_credits = payload.default_credits
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor_id,
        action="COURSE_UPDATE",
        entity_type="course",
        entity_id=str(course.id),
        before=before,
        after={"name": course.name, "default_credits": str(course.default_credits)},
    )
    return course


async def update_curriculum_course(
    db: AsyncSession,
    actor_id: uuid.UUID,
    curriculum_course_id: uuid.UUID,
    payload: CurriculumCourseUpdateIn,
) -> CurriculumCourse:
    cc = await crud.get_curriculum_course(db, curriculum_course_id)
    if cc is None:
        raise NotFoundError("Materia de la malla no encontrada.")
    before = {
        "reference_term": cc.reference_term,
        "credits": str(cc.credits),
        "hours": cc.hours,
        "is_required": cc.is_required,
        "organization_unit": cc.organization_unit.value,
    }
    if payload.reference_term is not None:
        cc.reference_term = payload.reference_term
    if payload.credits is not None:
        cc.credits = payload.credits
    if payload.hours is not None:
        cc.hours = payload.hours
    if payload.is_required is not None:
        cc.is_required = payload.is_required
    if payload.organization_unit is not None:
        cc.organization_unit = payload.organization_unit
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor_id,
        action="CURRICULUM_COURSE_UPDATE",
        entity_type="curriculum_course",
        entity_id=str(cc.id),
        before=before,
        after={
            "reference_term": cc.reference_term,
            "credits": str(cc.credits),
            "hours": cc.hours,
            "is_required": cc.is_required,
            "organization_unit": cc.organization_unit.value,
        },
    )
    return cc


async def add_requirement(
    db: AsyncSession, actor_id: uuid.UUID, payload: RequirementCreateIn
) -> CourseRequirement:
    target = await crud.get_curriculum_course(db, payload.curriculum_course_id)
    required = await crud.get_curriculum_course(db, payload.required_curriculum_course_id)
    if target is None or required is None:
        raise NotFoundError("Materia de la malla no encontrada.")
    if target.id == required.id:
        raise ValidationAppError("Una materia no puede ser su propio requisito.")
    if target.curriculum_id != required.curriculum_id:
        raise ValidationAppError("Ambas materias deben pertenecer a la misma malla.")
    existing = await crud.find_requirement(
        db,
        curriculum_course_id=target.id,
        required_curriculum_course_id=required.id,
        requirement_type=payload.requirement_type,
    )
    if existing is not None:
        raise ConflictError("Ese requisito ya existe.")
    requirement = CourseRequirement(
        curriculum_course_id=target.id,
        required_curriculum_course_id=required.id,
        requirement_type=payload.requirement_type,
    )
    db.add(requirement)
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor_id,
        action="REQUIREMENT_ADD",
        entity_type="course_requirement",
        entity_id=str(requirement.id),
        after={
            "curriculum_course_id": str(target.id),
            "required_curriculum_course_id": str(required.id),
            "requirement_type": payload.requirement_type.value,
        },
    )
    return requirement


async def remove_requirement(
    db: AsyncSession, actor_id: uuid.UUID, requirement_id: uuid.UUID
) -> None:
    requirement = await crud.get_course_requirement(db, requirement_id)
    if requirement is None:
        raise NotFoundError("Requisito no encontrado.")
    before = {
        "curriculum_course_id": str(requirement.curriculum_course_id),
        "required_curriculum_course_id": str(requirement.required_curriculum_course_id),
        "requirement_type": requirement.requirement_type.value,
    }
    await db.delete(requirement)
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor_id,
        action="REQUIREMENT_REMOVE",
        entity_type="course_requirement",
        entity_id=str(requirement_id),
        before=before,
    )
