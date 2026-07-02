"""Offering endpoints: professors, offerings, sections (ERS §17.2, §17.3)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.common.deps import CurrentUser, DbSession, require_admin
from app.modules.offering import crud, service
from app.modules.offering.schema import (
    CourseOfferingCreateIn,
    CourseOfferingOut,
    ProfessorCreateIn,
    ProfessorFindOrCreateIn,
    ProfessorOut,
    SectionCreateIn,
    SectionOut,
    SectionProfessorCreateIn,
    SectionProfessorOut,
)

router = APIRouter(tags=["offering"])


@router.get("/professors/search", response_model=list[ProfessorOut])
async def search_professors(
    db: DbSession, q: Annotated[str, Query(min_length=1)]
) -> list[ProfessorOut]:
    return list(await crud.search_professors(db, q))


@router.post("/professors", response_model=ProfessorOut)
async def find_or_create_professor(
    payload: ProfessorFindOrCreateIn, user: CurrentUser, db: DbSession
) -> ProfessorOut:
    professor = await service.find_or_create_professor(db, payload)
    return ProfessorOut.model_validate(professor)


@router.get("/course-offerings", response_model=list[CourseOfferingOut])
async def list_course_offerings(
    db: DbSession,
    period_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
) -> list[CourseOfferingOut]:
    return list(await crud.list_course_offerings(db, period_id, course_id))


# --- Admin ----------------------------------------------------------------------------------------

admin_router = APIRouter(
    prefix="/admin", tags=["admin-offering"], dependencies=[Depends(require_admin)]
)


@admin_router.post("/professors", response_model=ProfessorOut)
async def create_professor(payload: ProfessorCreateIn, db: DbSession) -> ProfessorOut:
    professor = await service.create_professor(db, payload)
    return ProfessorOut.model_validate(professor)


@admin_router.post("/course-offerings", response_model=CourseOfferingOut)
async def create_course_offering(
    payload: CourseOfferingCreateIn, db: DbSession
) -> CourseOfferingOut:
    offering = await service.create_course_offering(db, payload)
    return CourseOfferingOut.model_validate(offering)


@admin_router.post("/sections", response_model=SectionOut)
async def create_section(payload: SectionCreateIn, db: DbSession) -> SectionOut:
    section = await service.create_section(db, payload)
    return SectionOut.model_validate(section)


@admin_router.post("/section-professors", response_model=SectionProfessorOut)
async def create_section_professor(
    payload: SectionProfessorCreateIn, db: DbSession
) -> SectionProfessorOut:
    link = await service.create_section_professor(db, payload)
    return SectionProfessorOut.model_validate(link)
