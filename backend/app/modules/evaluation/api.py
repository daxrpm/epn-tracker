"""Evaluation scheme endpoints (ERS §17.7)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.common.deps import CurrentUser, DbSession
from app.common.exception.errors import NotFoundError
from app.modules.evaluation import crud, service
from app.modules.evaluation.schema import (
    ComponentOut,
    SchemeCopyOut,
    SchemeCreateIn,
    SchemeCreateOut,
    SchemeListItem,
    SchemeOut,
    SchemeSuggestionOut,
    VoteIn,
    VoteOut,
)

router = APIRouter(prefix="/evaluation-schemes", tags=["evaluation"])


@router.post("", response_model=SchemeCreateOut)
async def create_scheme(
    payload: SchemeCreateIn, user: CurrentUser, db: DbSession
) -> SchemeCreateOut:
    return await service.create_scheme(db, user, payload)


@router.get("", response_model=list[SchemeListItem])
async def list_schemes(
    db: DbSession,
    course_id: Annotated[uuid.UUID | None, Query()] = None,
    professor_id: Annotated[uuid.UUID | None, Query()] = None,
    section_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[SchemeListItem]:
    schemes = await crud.list_schemes(
        db, course_id=course_id, professor_id=professor_id, section_id=section_id
    )
    return [SchemeListItem.model_validate(s) for s in schemes]


@router.get("/suggest", response_model=list[SchemeSuggestionOut])
async def suggest_schemes(
    db: DbSession,
    course_id: Annotated[uuid.UUID, Query()],
    academic_period_id: Annotated[uuid.UUID | None, Query()] = None,
    section_id: Annotated[uuid.UUID | None, Query()] = None,
    professor_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[SchemeSuggestionOut]:
    return await service.suggest_schemes(
        db,
        course_id=course_id,
        academic_period_id=academic_period_id,
        section_id=section_id,
        professor_id=professor_id,
    )


@router.get("/{scheme_id}", response_model=SchemeOut)
async def get_scheme(scheme_id: uuid.UUID, db: DbSession) -> SchemeOut:
    scheme = await crud.get_scheme(db, scheme_id)
    if scheme is None or not scheme.is_active:
        raise NotFoundError("Esquema no encontrado.")
    components = await crud.get_components(db, scheme_id)
    return SchemeOut(
        id=scheme.id,
        course_id=scheme.course_id,
        title=scheme.title,
        status=scheme.status,
        visibility=scheme.visibility,
        approval_count=scheme.approval_count,
        components=[ComponentOut.model_validate(c) for c in components],
    )


@router.post("/{scheme_id}/vote", response_model=VoteOut)
async def vote_scheme(
    scheme_id: uuid.UUID, payload: VoteIn, user: CurrentUser, db: DbSession
) -> VoteOut:
    return await service.vote_scheme(db, user, scheme_id, payload.vote)


@router.post("/{scheme_id}/copy-to-personal", response_model=SchemeCopyOut)
async def copy_scheme_to_personal(
    scheme_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> SchemeCopyOut:
    return await service.copy_scheme_to_personal(db, user, scheme_id)
