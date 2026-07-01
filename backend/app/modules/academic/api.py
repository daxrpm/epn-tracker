"""Academic catalog and curriculum import endpoints (ERS §17.2, §17.3)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.deps import DbSession, require_admin
from app.common.enums import RequirementType
from app.common.exception.errors import NotFoundError
from app.modules.academic import crud, service
from app.modules.academic.schema import (
    AcademicPeriodCreateIn,
    AcademicPeriodOut,
    AcademicPeriodUpdateIn,
    CareerOut,
    CourseOut,
    CurriculumCourseOut,
    CurriculumImportIn,
    CurriculumOut,
    FacultyOut,
    ImportCommitOut,
    ImportValidationOut,
    InstitutionOut,
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
