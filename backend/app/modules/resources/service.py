"""Study resource creation, moderation and download (mirrors the evaluation-scheme pattern).

Students upload files/links; public ones start as ``COMMUNITY_PENDING`` and become
``COMMUNITY_VERIFIED`` after three external approvals, or ``ADMIN_VERIFIED`` when an admin acts.
User-facing messages stay in Spanish.
"""

from __future__ import annotations

import hashlib
import io
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import (
    ResourceKind,
    ResourceStatus,
    SchemeVote,
    UserRole,
    Visibility,
)
from app.common.exception.errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationAppError,
)
from app.core.conf import settings
from app.modules.iam.model import User
from app.modules.resources import crud, storage
from app.modules.resources.model import Resource, ResourceVote
from app.modules.resources.schema import (
    LinkResourceCreateIn,
    ResourceCreateOut,
    ResourceUpdateIn,
    VoteOut,
)

COMMUNITY_VERIFICATION_THRESHOLD = 3

# Extension -> (kind, allowed MIME prefixes). Extensions not listed are rejected.
_EXTENSION_MAP: dict[str, ResourceKind] = {
    "pdf": ResourceKind.PDF,
    "png": ResourceKind.IMAGE,
    "jpg": ResourceKind.IMAGE,
    "jpeg": ResourceKind.IMAGE,
    "webp": ResourceKind.IMAGE,
    "gif": ResourceKind.IMAGE,
    "md": ResourceKind.MARKDOWN,
    "markdown": ResourceKind.MARKDOWN,
    "txt": ResourceKind.TEXT,
    "text": ResourceKind.TEXT,
    "csv": ResourceKind.TEXT,
    "docx": ResourceKind.OFFICE,
    "doc": ResourceKind.OFFICE,
    "pptx": ResourceKind.OFFICE,
    "ppt": ResourceKind.OFFICE,
    "xlsx": ResourceKind.OFFICE,
    "xls": ResourceKind.OFFICE,
}

# Magic-byte prefixes for the sensitive binary kinds (defence in depth vs. a spoofed extension).
_MAGIC_PREFIXES: dict[ResourceKind, tuple[bytes, ...]] = {
    ResourceKind.PDF: (b"%PDF",),
}
_IMAGE_MAGIC: tuple[bytes, ...] = (
    b"\x89PNG\r\n\x1a\n",  # png
    b"\xff\xd8\xff",  # jpeg
    b"GIF87a",
    b"GIF89a",
    b"RIFF",  # webp container
)


def _extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _derive_kind(filename: str, blob: bytes) -> ResourceKind:
    ext = _extension_of(filename)
    kind = _EXTENSION_MAP.get(ext)
    if kind is None:
        raise ValidationAppError(
            "Tipo de archivo no permitido. Usa PDF, imagen, .md, .txt o documentos de oficina."
        )
    # Reject a binary whose magic bytes contradict its claimed extension.
    if kind == ResourceKind.PDF and not blob.startswith(_MAGIC_PREFIXES[ResourceKind.PDF]):
        raise ValidationAppError("El archivo no es un PDF válido.")
    if kind == ResourceKind.IMAGE and not blob.startswith(_IMAGE_MAGIC):
        raise ValidationAppError("El archivo no es una imagen válida.")
    return kind


def _extract_text(kind: ResourceKind, blob: bytes) -> str | None:
    """Best-effort text extraction for small files; never raises (returns None on failure)."""
    try:
        if kind in (ResourceKind.TEXT, ResourceKind.MARKDOWN):
            return blob.decode("utf-8", errors="replace")
        if kind == ResourceKind.PDF:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(blob))
            return "\n".join((page.extract_text() or "") for page in reader.pages).strip() or None
    except Exception:  # noqa: BLE001 - extraction must never fail the upload
        return None
    return None


def _initial_status(user: User, visibility: Visibility) -> ResourceStatus:
    """Same lifecycle as evaluation schemes (ERS §RF-019)."""
    is_admin = user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    if visibility == Visibility.PRIVATE:
        return ResourceStatus.PERSONAL
    if is_admin:
        return ResourceStatus.ADMIN_VERIFIED
    return ResourceStatus.COMMUNITY_PENDING


async def create_file_resource(
    db: AsyncSession,
    user: User,
    *,
    blob: bytes,
    filename: str,
    content_type: str | None,
    course_id: uuid.UUID,
    title: str,
    description: str | None,
    tema: str | None,
    contribution: object | None,
    professor_id: uuid.UUID | None,
    academic_period_id: uuid.UUID | None,
    visibility: Visibility,
) -> ResourceCreateOut:
    max_bytes = settings.resource_max_upload_mb * 1024 * 1024
    if not blob:
        raise ValidationAppError("El archivo está vacío.")
    if len(blob) > max_bytes:
        raise ValidationAppError(
            f"El archivo supera el límite de {settings.resource_max_upload_mb} MB."
        )

    kind = _derive_kind(filename, blob)
    checksum = hashlib.sha256(blob).hexdigest()

    # Auto-stamp the current academic period when the uploader didn't set one.
    if academic_period_id is None:
        current = await crud.get_current_period(db)
        academic_period_id = current.id if current is not None else None

    resource = Resource(
        course_id=course_id,
        academic_period_id=academic_period_id,
        professor_id=professor_id,
        created_by_user_id=user.id,
        title=title,
        description=description,
        tema=tema,
        contribution=contribution,
        kind=kind,
        status=_initial_status(user, visibility),
        visibility=visibility,
        original_filename=filename,
        content_type=content_type or "application/octet-stream",
        size_bytes=len(blob),
        checksum_sha256=checksum,
        bucket=settings.s3_bucket,
    )
    db.add(resource)
    await db.flush()  # assigns resource.id for the object key

    ext = _extension_of(filename)
    object_key = f"resources/{course_id}/{resource.id}/{uuid.uuid4().hex}.{ext}"
    await storage.put_object(object_key, blob, resource.content_type)
    resource.object_key = object_key

    # Cheap synchronous text extraction for small files; large files are deferred (Phase 5).
    if (
        kind in (ResourceKind.PDF, ResourceKind.TEXT, ResourceKind.MARKDOWN)
        and len(blob) <= settings.resource_extract_sync_mb * 1024 * 1024
    ):
        text = _extract_text(kind, blob)
        if text:
            resource.extracted_text = text
            resource.text_extracted = True

    await db.flush()
    return ResourceCreateOut(id=resource.id, status=resource.status, kind=resource.kind)


async def create_link_resource(
    db: AsyncSession, user: User, payload: LinkResourceCreateIn
) -> ResourceCreateOut:
    resource = Resource(
        course_id=payload.course_id,
        academic_period_id=payload.academic_period_id,
        professor_id=payload.professor_id,
        created_by_user_id=user.id,
        title=payload.title,
        description=payload.description,
        tema=payload.tema,
        contribution=payload.contribution,
        kind=ResourceKind.LINK,
        status=_initial_status(user, payload.visibility),
        visibility=payload.visibility,
        external_url=payload.external_url,
    )
    if resource.academic_period_id is None:
        current = await crud.get_current_period(db)
        resource.academic_period_id = current.id if current is not None else None
    db.add(resource)
    await db.flush()
    return ResourceCreateOut(id=resource.id, status=resource.status, kind=resource.kind)


async def vote_resource(
    db: AsyncSession, user: User, resource_id: uuid.UUID, vote: SchemeVote
) -> VoteOut:
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active:
        raise NotFoundError("Recurso no encontrado.")
    if not user.is_verified:
        raise ForbiddenError("Debes verificar tu correo para votar.")
    if resource.created_by_user_id == user.id:
        raise ForbiddenError("No puedes votar tu propio recurso.")
    if await crud.get_user_vote(db, resource_id, user.id) is not None:
        raise ConflictError("Ya votaste este recurso.")

    db.add(ResourceVote(resource_id=resource_id, user_id=user.id, vote=vote))
    if vote == SchemeVote.APPROVE:
        resource.approval_count += 1
        if (
            resource.approval_count >= COMMUNITY_VERIFICATION_THRESHOLD
            and resource.status == ResourceStatus.COMMUNITY_PENDING
        ):
            resource.status = ResourceStatus.COMMUNITY_VERIFIED

    await db.flush()
    return VoteOut(
        resource_id=resource.id, status=resource.status, approval_count=resource.approval_count
    )


def _can_moderate(user: User) -> bool:
    return user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)


async def update_resource(
    db: AsyncSession, user: User, resource_id: uuid.UUID, payload: ResourceUpdateIn
) -> Resource:
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active:
        raise NotFoundError("Recurso no encontrado.")
    if resource.created_by_user_id != user.id and not _can_moderate(user):
        raise ForbiddenError("No puedes editar este recurso.")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(resource, field, value)
    await db.flush()
    return resource


async def moderate_resource(
    db: AsyncSession, admin: User, resource_id: uuid.UUID, action: str
) -> Resource:
    """action ∈ {approve, reject, delete}. Admin-only (guarded by the router dependency)."""
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active:
        raise NotFoundError("Recurso no encontrado.")
    if action == "approve":
        resource.status = ResourceStatus.ADMIN_VERIFIED
        resource.visibility = Visibility.PUBLIC
    elif action == "reject":
        resource.status = ResourceStatus.REJECTED
    elif action == "delete":
        resource.is_active = False
        if resource.object_key:
            await storage.delete_object(resource.object_key)
    else:  # pragma: no cover - guarded by the router
        raise ValidationAppError("Acción de moderación inválida.")
    await db.flush()
    return resource


def _is_visible_to(resource: Resource, user: User) -> bool:
    if resource.created_by_user_id == user.id or _can_moderate(user):
        return True
    return resource.status in (
        ResourceStatus.COMMUNITY_PENDING,
        ResourceStatus.COMMUNITY_VERIFIED,
        ResourceStatus.ADMIN_VERIFIED,
    )


async def get_download_url(
    db: AsyncSession, user: User, resource_id: uuid.UUID
) -> tuple[Resource, str | None]:
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active:
        raise NotFoundError("Recurso no encontrado.")
    if not _is_visible_to(resource, user):
        raise ForbiddenError("No tienes acceso a este recurso.")
    if resource.kind == ResourceKind.LINK:
        return resource, resource.external_url
    if resource.object_key is None:
        return resource, None
    url = await storage.presigned_get_url(
        resource.object_key, filename=resource.original_filename
    )
    return resource, url
