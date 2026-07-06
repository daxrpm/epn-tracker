"""Study resource endpoints (recursos).

Two routers: a student/public one (upload, list, view, vote) and an admin moderation one.
Files are uploaded as multipart and streamed to MinIO after server-side validation.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.deps import CurrentUser, DbSession, require_admin
from app.common.enums import (
    Contribution,
    ResourceKind,
    ResourceStatus,
    UserRole,
    Visibility,
)
from app.common.exception.errors import NotFoundError
from app.modules.academic import crud as academic_crud
from app.modules.offering import crud as offering_crud
from app.modules.resources import crud, service, storage
from app.modules.resources.model import Resource
from app.modules.resources.schema import (
    LinkResourceCreateIn,
    ResourceCreateOut,
    ResourceDetail,
    ResourceListItem,
    ResourceUpdateIn,
    VoteIn,
    VoteOut,
)

router = APIRouter(prefix="/resources", tags=["resources"])
admin_router = APIRouter(
    prefix="/admin/resources",
    tags=["admin-resources"],
    dependencies=[Depends(require_admin)],
)


# --- Resolver helpers (batch lookups; no ORM relationships on Resource) ----------------------


async def _professor_names(
    db: AsyncSession, professor_ids: Iterable[uuid.UUID | None]
) -> dict[uuid.UUID, str]:
    ids = {pid for pid in professor_ids if pid is not None}
    professors = await offering_crud.get_professors_by_ids(db, list(ids))
    return {p.id: p.full_name for p in professors}


async def _period_codes(db: AsyncSession) -> dict[uuid.UUID, str]:
    periods = await academic_crud.list_academic_periods(db)
    return {p.id: p.code for p in periods}


def _to_list_item(
    resource: Resource,
    *,
    professor_names: dict[uuid.UUID, str],
    period_codes: dict[uuid.UUID, str],
    user_id: uuid.UUID,
) -> ResourceListItem:
    return ResourceListItem(
        id=resource.id,
        course_id=resource.course_id,
        title=resource.title,
        description=resource.description,
        tema=resource.tema,
        kind=resource.kind,
        contribution=resource.contribution,
        status=resource.status,
        visibility=resource.visibility,
        approval_count=resource.approval_count,
        professor_id=resource.professor_id,
        professor_name=(
            professor_names.get(resource.professor_id) if resource.professor_id else None
        ),
        academic_period_id=resource.academic_period_id,
        academic_period_code=(
            period_codes.get(resource.academic_period_id)
            if resource.academic_period_id
            else None
        ),
        original_filename=resource.original_filename,
        content_type=resource.content_type,
        size_bytes=resource.size_bytes,
        external_url=resource.external_url,
        created_by_user_id=resource.created_by_user_id,
        is_owner=resource.created_by_user_id == user_id,
        created_at=resource.created_at,
    )


def _visible(resources: Sequence[Resource], user: CurrentUser) -> list[Resource]:
    is_admin = user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    visible_statuses = {
        ResourceStatus.COMMUNITY_PENDING,
        ResourceStatus.COMMUNITY_VERIFIED,
        ResourceStatus.ADMIN_VERIFIED,
    }
    out: list[Resource] = []
    for r in resources:
        if is_admin or r.created_by_user_id == user.id or r.status in visible_statuses:
            out.append(r)
    return out


# --- Create ----------------------------------------------------------------------------------


@router.post("", response_model=ResourceCreateOut)
async def create_file_resource(
    user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
    course_id: Annotated[uuid.UUID, Form()],
    title: Annotated[str, Form()],
    description: Annotated[str | None, Form()] = None,
    tema: Annotated[str | None, Form()] = None,
    contribution: Annotated[Contribution | None, Form()] = None,
    professor_id: Annotated[uuid.UUID | None, Form()] = None,
    academic_period_id: Annotated[uuid.UUID | None, Form()] = None,
    visibility: Annotated[Visibility, Form()] = Visibility.COMMUNITY,
) -> ResourceCreateOut:
    blob = await file.read()
    return await service.create_file_resource(
        db,
        user,
        blob=blob,
        filename=file.filename or "archivo",
        content_type=file.content_type,
        course_id=course_id,
        title=title,
        description=description,
        tema=tema,
        contribution=contribution,
        professor_id=professor_id,
        academic_period_id=academic_period_id,
        visibility=visibility,
    )


@router.post("/links", response_model=ResourceCreateOut)
async def create_link_resource(
    payload: LinkResourceCreateIn, user: CurrentUser, db: DbSession
) -> ResourceCreateOut:
    return await service.create_link_resource(db, user, payload)


# --- Read ------------------------------------------------------------------------------------


@router.get("", response_model=list[ResourceListItem])
async def list_resources(
    user: CurrentUser,
    db: DbSession,
    course_id: Annotated[uuid.UUID | None, Query()] = None,
    academic_period_id: Annotated[uuid.UUID | None, Query()] = None,
    professor_id: Annotated[uuid.UUID | None, Query()] = None,
    contribution: Annotated[Contribution | None, Query()] = None,
    kind: Annotated[ResourceKind | None, Query()] = None,
    tema: Annotated[str | None, Query()] = None,
    mine: Annotated[bool, Query()] = False,
) -> list[ResourceListItem]:
    resources = await crud.list_resources(
        db,
        course_id=course_id,
        academic_period_id=academic_period_id,
        professor_id=professor_id,
        contribution=contribution,
        kind=kind,
        tema=tema,
    )
    if mine:
        resources = [r for r in resources if r.created_by_user_id == user.id]
    else:
        resources = _visible(resources, user)
    professor_names = await _professor_names(db, (r.professor_id for r in resources))
    period_codes = await _period_codes(db)
    return [
        _to_list_item(
            r,
            professor_names=professor_names,
            period_codes=period_codes,
            user_id=user.id,
        )
        for r in resources
    ]


@router.get("/{resource_id}", response_model=ResourceDetail)
async def get_resource(
    resource_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ResourceDetail:
    resource, download_url = await service.get_download_url(db, user, resource_id)
    professor_names = await _professor_names(db, [resource.professor_id])
    period_codes = await _period_codes(db)
    base = _to_list_item(
        resource,
        professor_names=professor_names,
        period_codes=period_codes,
        user_id=user.id,
    )
    course = await academic_crud.get_course(db, resource.course_id)
    return ResourceDetail(
        **base.model_dump(),
        course_code=course.code if course else None,
        course_name=course.name if course else None,
        can_moderate=user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN),
        download_url=download_url,
    )


@router.get("/{resource_id}/content")
async def get_resource_content(
    resource_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> StreamingResponse:
    """Same-origin inline preview proxy (avoids cross-origin CORS with MinIO)."""
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active or resource.object_key is None:
        raise NotFoundError("Recurso no encontrado.")
    if not service._is_visible_to(resource, user):
        raise NotFoundError("Recurso no encontrado.")
    body_iter, content_type = await storage.stream_object(resource.object_key)
    return StreamingResponse(
        body_iter,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{resource.original_filename}"'},
    )


# --- Vote / update ---------------------------------------------------------------------------


@router.post("/{resource_id}/vote", response_model=VoteOut)
async def vote_resource(
    resource_id: uuid.UUID, payload: VoteIn, user: CurrentUser, db: DbSession
) -> VoteOut:
    return await service.vote_resource(db, user, resource_id, payload.vote)


@router.patch("/{resource_id}", response_model=ResourceCreateOut)
async def update_resource(
    resource_id: uuid.UUID, payload: ResourceUpdateIn, user: CurrentUser, db: DbSession
) -> ResourceCreateOut:
    resource = await service.update_resource(db, user, resource_id, payload)
    return ResourceCreateOut(id=resource.id, status=resource.status, kind=resource.kind)


# --- Admin moderation ------------------------------------------------------------------------


@admin_router.get("", response_model=list[ResourceListItem])
async def list_pending(user: CurrentUser, db: DbSession) -> list[ResourceListItem]:
    resources = await crud.list_resources(
        db, status_in=[ResourceStatus.COMMUNITY_PENDING]
    )
    professor_names = await _professor_names(db, (r.professor_id for r in resources))
    period_codes = await _period_codes(db)
    return [
        _to_list_item(
            r,
            professor_names=professor_names,
            period_codes=period_codes,
            user_id=user.id,
        )
        for r in resources
    ]


@admin_router.post("/{resource_id}/approve", response_model=ResourceCreateOut)
async def approve_resource(
    resource_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ResourceCreateOut:
    resource = await service.moderate_resource(db, user, resource_id, "approve")
    return ResourceCreateOut(id=resource.id, status=resource.status, kind=resource.kind)


@admin_router.post("/{resource_id}/reject", response_model=ResourceCreateOut)
async def reject_resource(
    resource_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ResourceCreateOut:
    resource = await service.moderate_resource(db, user, resource_id, "reject")
    return ResourceCreateOut(id=resource.id, status=resource.status, kind=resource.kind)


@admin_router.delete("/{resource_id}")
async def delete_resource(
    resource_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> dict[str, bool]:
    await service.moderate_resource(db, user, resource_id, "delete")
    return {"deleted": True}
