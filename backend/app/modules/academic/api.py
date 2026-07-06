"""Academic catalog and curriculum import endpoints (ERS §17.2, §17.3)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.deps import CurrentUser, DbSession, require_admin
from app.common.enums import RequirementType
from app.common.exception.errors import NotFoundError
from app.modules.academic import crud, service
from app.modules.academic.schema import (
    AcademicPeriodCreateIn,
    AcademicPeriodOut,
    AcademicPeriodUpdateIn,
    CareerOut,
    CareerUpdateIn,
    CourseOut,
    CourseUpdateIn,
    CurriculumCourseOut,
    CurriculumCourseUpdateIn,
    CurriculumImportIn,
    CurriculumOut,
    FacultyOut,
    ImportCommitOut,
    ImportValidationOut,
    InstitutionOut,
    RequirementCreateIn,
    RequirementDetailOut,
    RequirementEdgeOut,
    RequirementOut,
)

router = APIRouter(tags=["academic"])


@router.get("/institutions", response_model=list[InstitutionOut])
async def list_institutions(db: DbSession) -> list[InstitutionOut]:
    return list(await crud.list_institutions(db))


@router.get("/faculties", response_model=list[FacultyOut])
async def list_faculties(db: DbSession) -> list[FacultyOut]:
    return list(await crud.list_faculties(db))


@router.get("/careers", response_model=list[CareerOut])
async def list_careers(db: DbSession) -> list[CareerOut]:
    return list(await crud.list_careers(db))


@router.get("/careers/{career_id}", response_model=CareerOut)
async def get_career(career_id: uuid.UUID, db: DbSession) -> CareerOut:
    career = await crud.get_career(db, career_id)
    if career is None:
        raise NotFoundError("Carrera no encontrada.")
    return CareerOut.model_validate(career)


@router.get("/curricula", response_model=list[CurriculumOut])
async def list_curricula(db: DbSession) -> list[CurriculumOut]:
    return list(await crud.list_curricula(db))


@router.get("/curricula/{curriculum_id}", response_model=CurriculumOut)
async def get_curriculum(curriculum_id: uuid.UUID, db: DbSession) -> CurriculumOut:
    curriculum = await crud.get_curriculum(db, curriculum_id)
    if curriculum is None:
        raise NotFoundError("Malla no encontrada.")
    return CurriculumOut.model_validate(curriculum)


@router.get("/curricula/{curriculum_id}/courses", response_model=list[CurriculumCourseOut])
async def get_curriculum_courses(
    curriculum_id: uuid.UUID, db: DbSession
) -> list[CurriculumCourseOut]:
    curriculum = await crud.get_curriculum(db, curriculum_id)
    if curriculum is None:
        raise NotFoundError("Malla no encontrada.")

    curriculum_courses = list(await crud.list_curriculum_courses(db, curriculum_id))
    course_ids = [cc.course_id for cc in curriculum_courses]
    courses = {c.id: c for c in await crud.get_courses_by_ids(db, course_ids)}
    cc_id_to_code = {cc.id: courses[cc.course_id].code for cc in curriculum_courses}

    requirements = await crud.requirements_for_curriculum(
        db, [cc.id for cc in curriculum_courses]
    )
    prerequisites: dict[uuid.UUID, list[str]] = {}
    corequisites: dict[uuid.UUID, list[str]] = {}
    for req in requirements:
        bucket = (
            prerequisites if req.requirement_type == RequirementType.PREREQUISITE else corequisites
        )
        bucket.setdefault(req.curriculum_course_id, []).append(
            cc_id_to_code.get(req.required_curriculum_course_id, "?")
        )

    return [
        CurriculumCourseOut(
            id=cc.id,
            course_id=cc.course_id,
            code=courses[cc.course_id].code,
            name=courses[cc.course_id].name,
            reference_term=cc.reference_term,
            credits=cc.credits,
            hours=cc.hours,
            organization_unit=cc.organization_unit,
            is_required=cc.is_required,
            prerequisite_codes=prerequisites.get(cc.id, []),
            corequisite_codes=corequisites.get(cc.id, []),
        )
        for cc in curriculum_courses
    ]


@router.get("/courses/search", response_model=list[CourseOut])
async def search_courses(db: DbSession, q: Annotated[str, Query(min_length=1)]) -> list[CourseOut]:
    return list(await crud.search_courses(db, q))


@router.get("/courses/{course_id}", response_model=CourseOut)
async def get_course(course_id: uuid.UUID, db: DbSession) -> CourseOut:
    course = await crud.get_course(db, course_id)
    if course is None:
        raise NotFoundError("Materia no encontrada.")
    return CourseOut.model_validate(course)


@router.get("/academic-periods", response_model=list[AcademicPeriodOut])
async def list_academic_periods(db: DbSession) -> list[AcademicPeriodOut]:
    return list(await crud.list_academic_periods(db))


# --- Admin: academic periods ----------------------------------------------------------------------

period_admin_router = APIRouter(
    prefix="/admin/academic-periods",
    tags=["admin-academic"],
    dependencies=[Depends(require_admin)],
)


@period_admin_router.post("", response_model=AcademicPeriodOut)
async def create_academic_period(
    payload: AcademicPeriodCreateIn, db: DbSession
) -> AcademicPeriodOut:
    period = await service.create_academic_period(db, payload)
    return AcademicPeriodOut.model_validate(period)


@period_admin_router.patch("/{period_id}", response_model=AcademicPeriodOut)
async def update_academic_period(
    period_id: uuid.UUID, payload: AcademicPeriodUpdateIn, db: DbSession
) -> AcademicPeriodOut:
    period = await service.update_academic_period(db, period_id, payload)
    return AcademicPeriodOut.model_validate(period)


# --- Admin: curriculum import ---------------------------------------------------------------------

admin_router = APIRouter(prefix="/admin/curricula", tags=["admin-academic"])


@admin_router.post(
    "/import/validate",
    response_model=ImportValidationOut,
    dependencies=[Depends(require_admin)],
)
async def validate_curriculum_import(payload: CurriculumImportIn) -> ImportValidationOut:
    return service.validate_import(payload)


@admin_router.post(
    "/import/commit",
    response_model=ImportCommitOut,
    dependencies=[Depends(require_admin)],
)
async def commit_curriculum_import(payload: CurriculumImportIn, db: DbSession) -> ImportCommitOut:
    return await service.commit_import(db, payload)


# --- Admin: direct content editing (courses, mallas, requisitos) ---
# Admins edit these directly, no community approval (ERS §17.3); every change is audited.

content_admin_router = APIRouter(
    prefix="/admin", tags=["admin-academic"], dependencies=[Depends(require_admin)]
)


async def _curriculum_course_out(db: DbSession, cc) -> CurriculumCourseOut:
    course = await crud.get_course(db, cc.course_id)
    reqs = await crud.requirements_for_curriculum(db, [cc.id])
    code_of: dict = {}
    for req in reqs:
        required_cc = await crud.get_curriculum_course(db, req.required_curriculum_course_id)
        if required_cc is not None:
            rc = await crud.get_course(db, required_cc.course_id)
            code_of[req.required_curriculum_course_id] = rc.code if rc else "?"
    pre = [
        code_of.get(r.required_curriculum_course_id, "?")
        for r in reqs
        if r.requirement_type == RequirementType.PREREQUISITE
    ]
    co = [
        code_of.get(r.required_curriculum_course_id, "?")
        for r in reqs
        if r.requirement_type == RequirementType.COREQUISITE
    ]
    return CurriculumCourseOut(
        id=cc.id,
        course_id=cc.course_id,
        code=course.code if course else "?",
        name=course.name if course else "?",
        reference_term=cc.reference_term,
        credits=cc.credits,
        hours=cc.hours,
        organization_unit=cc.organization_unit,
        is_required=cc.is_required,
        prerequisite_codes=pre,
        corequisite_codes=co,
    )


@content_admin_router.patch("/careers/{career_id}", response_model=CareerOut)
async def update_career(
    career_id: uuid.UUID, payload: CareerUpdateIn, actor: CurrentUser, db: DbSession
) -> CareerOut:
    return CareerOut.model_validate(
        await service.update_career(db, actor.id, career_id, payload)
    )


@content_admin_router.patch("/courses/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: uuid.UUID, payload: CourseUpdateIn, actor: CurrentUser, db: DbSession
) -> CourseOut:
    return CourseOut.model_validate(
        await service.update_course(db, actor.id, course_id, payload)
    )


@content_admin_router.patch(
    "/curriculum-courses/{curriculum_course_id}", response_model=CurriculumCourseOut
)
async def update_curriculum_course(
    curriculum_course_id: uuid.UUID,
    payload: CurriculumCourseUpdateIn,
    actor: CurrentUser,
    db: DbSession,
) -> CurriculumCourseOut:
    cc = await service.update_curriculum_course(db, actor.id, curriculum_course_id, payload)
    return await _curriculum_course_out(db, cc)


@content_admin_router.get(
    "/curriculum-courses/{curriculum_course_id}/requirements",
    response_model=list[RequirementDetailOut],
)
async def list_curriculum_course_requirements(
    curriculum_course_id: uuid.UUID, db: DbSession
) -> list[RequirementDetailOut]:
    reqs = await crud.requirements_for_curriculum(db, [curriculum_course_id])
    out: list[RequirementDetailOut] = []
    for req in reqs:
        required_cc = await crud.get_curriculum_course(db, req.required_curriculum_course_id)
        code = "?"
        if required_cc is not None:
            rc = await crud.get_course(db, required_cc.course_id)
            code = rc.code if rc else "?"
        out.append(
            RequirementDetailOut(
                id=req.id,
                required_curriculum_course_id=req.required_curriculum_course_id,
                required_code=code,
                requirement_type=req.requirement_type,
            )
        )
    return out


@content_admin_router.get(
    "/curricula/{curriculum_id}/requirements",
    response_model=list[RequirementEdgeOut],
)
async def list_curriculum_requirements(
    curriculum_id: uuid.UUID, db: DbSession
) -> list[RequirementEdgeOut]:
    """Every requirement edge (with its id) in the malla, so the visual editor can delete arrows."""
    curriculum_courses = list(await crud.list_curriculum_courses(db, curriculum_id))
    reqs = await crud.requirements_for_curriculum(db, [cc.id for cc in curriculum_courses])
    return [RequirementEdgeOut.model_validate(req) for req in reqs]


@content_admin_router.post("/course-requirements", response_model=RequirementOut)
async def add_requirement(
    payload: RequirementCreateIn, actor: CurrentUser, db: DbSession
) -> RequirementOut:
    return RequirementOut.model_validate(await service.add_requirement(db, actor.id, payload))


@content_admin_router.delete("/course-requirements/{requirement_id}")
async def remove_requirement(
    requirement_id: uuid.UUID, actor: CurrentUser, db: DbSession
) -> dict[str, bool]:
    await service.remove_requirement(db, actor.id, requirement_id)
    return {"deleted": True}
