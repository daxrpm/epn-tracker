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
from app.common.exception.errors import NotFoundError, ValidationAppError
from app.common.pagination import Page
from app.core.conf import settings
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


async def _period_codes_for(
    db: AsyncSession, resources: Sequence[Resource]
) -> dict[uuid.UUID, str]:
    """Resolve only the periods actually referenced, instead of the whole catalog per request."""
    ids = [r.academic_period_id for r in resources if r.academic_period_id is not None]
    periods = await academic_crud.get_academic_periods_by_ids(db, ids)
    return {p.id: p.code for p in periods}


# --- Create ----------------------------------------------------------------------------------


_UPLOAD_CHUNK_BYTES = 64 * 1024


async def _read_within_limit(file: UploadFile, max_bytes: int) -> bytes:
    """Read an upload in chunks, aborting as soon as it exceeds ``max_bytes``.

    Reading the whole part first and checking its size afterwards lets a single request pin
    arbitrary memory before we ever get to reject it.
    """
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_UPLOAD_CHUNK_BYTES):
        total += len(chunk)
        if total > max_bytes:
            raise ValidationAppError(
                f"El archivo supera el límite de {settings.resource_max_upload_mb} MB."
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("", response_model=ResourceCreateOut)
async def create_file_resource(
    user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
    course_id: Annotated[uuid.UUID, Form()],
    title: Annotated[str, Form(min_length=1, max_length=255)],
    description: Annotated[str | None, Form(max_length=2000)] = None,
    tema: Annotated[str | None, Form(max_length=255)] = None,
    contribution: Annotated[Contribution | None, Form()] = None,
    professor_id: Annotated[uuid.UUID | None, Form()] = None,
    academic_period_id: Annotated[uuid.UUID | None, Form()] = None,
    visibility: Annotated[Visibility, Form()] = Visibility.COMMUNITY,
) -> ResourceCreateOut:
    blob = await _read_within_limit(file, settings.resource_max_upload_mb * 1024 * 1024)
    return await service.create_file_resource(
        db,
        user,
        blob=blob,
        filename=file.filename or "archivo",
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
    page: Page,
    course_id: Annotated[uuid.UUID | None, Query()] = None,
    academic_period_id: Annotated[uuid.UUID | None, Query()] = None,
    professor_id: Annotated[uuid.UUID | None, Query()] = None,
    contribution: Annotated[Contribution | None, Query()] = None,
    kind: Annotated[ResourceKind | None, Query()] = None,
    tema: Annotated[str | None, Query(max_length=255)] = None,
    q: Annotated[str | None, Query(max_length=255)] = None,
    mine: Annotated[bool, Query()] = False,
) -> list[ResourceListItem]:
    """Browse resources. Visibility and search both run in SQL, never over a full table read."""
    resources = await crud.list_resources(
        db,
        course_id=course_id,
        academic_period_id=academic_period_id,
        professor_id=professor_id,
        contribution=contribution,
        kind=kind,
        tema=tema,
        search=q,
        visible_to_user_id=user.id,
        include_hidden=user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN),
        owned_only=mine,
        limit=page.limit,
        offset=page.offset,
    )
    professor_names = await _professor_names(db, (r.professor_id for r in resources))
    period_codes = await _period_codes_for(db, resources)
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
    period_codes = await _period_codes_for(db, [resource])
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
    """Same-origin preview proxy (avoids cross-origin CORS with MinIO).

    The content type comes from our own validated metadata, and the response is served as an
    attachment under the API's restrictive CSP, so a file whose bytes disagree with its extension
    still cannot execute in the browser.
    """
    resource = await service.get_visible_resource(db, user, resource_id)
    if resource.object_key is None:
        raise NotFoundError("Recurso no encontrado.")

    filename = service.safe_filename(resource.original_filename or "archivo")
    body_iter, content_length = await storage.stream_object(resource.object_key)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if content_length is not None:
        headers["Content-Length"] = str(content_length)
    return StreamingResponse(
        body_iter,
        media_type=resource.content_type or "application/octet-stream",
        headers=headers,
    )


@router.delete("/{resource_id}")
async def delete_own_resource(
    resource_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> dict[str, bool]:
    """Withdraw a resource you uploaded (moderators can withdraw any)."""
    await service.delete_own_resource(db, user, resource_id)
    return {"deleted": True}


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
async def list_pending(
    user: CurrentUser, db: DbSession, page: Page
) -> list[ResourceListItem]:
    resources = await crud.list_resources(
        db,
        status_in=[ResourceStatus.COMMUNITY_PENDING],
        include_hidden=True,
        limit=page.limit,
        offset=page.offset,
    )
    professor_names = await _professor_names(db, (r.professor_id for r in resources))
    period_codes = await _period_codes_for(db, resources)
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
