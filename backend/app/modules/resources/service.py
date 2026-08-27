"""Study resource creation, moderation and download (mirrors the evaluation-scheme pattern).

Students upload files/links; public ones start as ``COMMUNITY_PENDING`` and become
``COMMUNITY_VERIFIED`` after three external approvals, or ``ADMIN_VERIFIED`` when an admin acts.
User-facing messages stay in Spanish.
"""

from __future__ import annotations

import hashlib
import io
import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import (
    PUBLICLY_VISIBLE_RESOURCE_STATUSES,
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
from app.modules.academic.model import AcademicPeriod, Course
from app.modules.iam.model import User
from app.modules.offering.model import Professor
from app.modules.resources import crud, storage
from app.modules.resources.model import Resource, ResourceVote
from app.modules.resources.schema import (
    LinkResourceCreateIn,
    ResourceCreateOut,
    ResourceUpdateIn,
    VoteOut,
)

COMMUNITY_VERIFICATION_THRESHOLD = 3
COMMUNITY_REJECTION_THRESHOLD = 3

#: Once the community has vouched for a resource, only a moderator may withdraw it.
_COMMUNITY_OWNED_STATUSES = (
    ResourceStatus.COMMUNITY_VERIFIED,
    ResourceStatus.ADMIN_VERIFIED,
)

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


# The content type we serve is derived from the validated kind, never echoed back from the
# upload. A ``.txt`` announced as ``text/html`` would otherwise be replayed as executable markup
# by the preview proxy (ERS §25.5).
_CONTENT_TYPE_BY_EXTENSION: dict[str, str] = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "md": "text/markdown; charset=utf-8",
    "markdown": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
    "text": "text/plain; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_MAX_FILENAME_LENGTH = 120


def _extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def safe_filename(filename: str) -> str:
    """Reduce an uploaded name to something safe to store and to put in a header.

    The value ends up inside ``Content-Disposition``; quotes or newlines there would let the
    uploader forge response headers.
    """
    cleaned = _UNSAFE_FILENAME_CHARS.sub("_", filename.strip()).strip("._-")
    return (cleaned or "archivo")[:_MAX_FILENAME_LENGTH]


def content_type_for(filename: str) -> str:
    """The MIME type we will serve this file as, derived from its validated extension."""
    return _CONTENT_TYPE_BY_EXTENSION.get(_extension_of(filename), "application/octet-stream")


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
    course_id: uuid.UUID,
    title: str,
    description: str | None,
    tema: str | None,
    contribution: object | None,
    professor_id: uuid.UUID | None,
    academic_period_id: uuid.UUID | None,
    visibility: Visibility,
) -> ResourceCreateOut:
    if not blob:
        raise ValidationAppError("El archivo está vacío.")
    if await db.get(Course, course_id) is None:
        raise NotFoundError("Materia no encontrada.")
    await _validate_optional_context(db, professor_id, academic_period_id)

    filename = safe_filename(filename)
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
        content_type=content_type_for(filename),
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


async def _validate_optional_context(
    db: AsyncSession,
    professor_id: uuid.UUID | None,
    academic_period_id: uuid.UUID | None,
) -> None:
    """Turn unknown optional foreign keys into 404s instead of a 500 at commit time."""
    if professor_id is not None and await db.get(Professor, professor_id) is None:
        raise NotFoundError("Docente no encontrado.")
    if (
        academic_period_id is not None
        and await db.get(AcademicPeriod, academic_period_id) is None
    ):
        raise NotFoundError("Periodo académico no encontrado.")


async def create_link_resource(
    db: AsyncSession, user: User, payload: LinkResourceCreateIn
) -> ResourceCreateOut:
    if await db.get(Course, payload.course_id) is None:
        raise NotFoundError("Materia no encontrada.")
    await _validate_optional_context(db, payload.professor_id, payload.academic_period_id)
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
    resource = await get_visible_resource(db, user, resource_id)
    if not user.is_verified:
        raise ForbiddenError("Debes verificar tu correo para votar.")
    if resource.created_by_user_id == user.id:
        raise ForbiddenError("No puedes votar tu propio recurso.")
    if resource.status != ResourceStatus.COMMUNITY_PENDING:
        raise ConflictError("Este recurso ya no está en votación comunitaria.")
    if await crud.get_user_vote(db, resource_id, user.id) is not None:
        raise ConflictError("Ya votaste este recurso.")

    db.add(ResourceVote(resource_id=resource_id, user_id=user.id, vote=vote))
    await db.flush()

    # Derived from the vote rows so concurrent votes cannot collapse into one.
    resource.approval_count = await crud.count_votes(db, resource_id, SchemeVote.APPROVE)
    rejections = await crud.count_votes(db, resource_id, SchemeVote.REJECT)
    if resource.approval_count >= COMMUNITY_VERIFICATION_THRESHOLD:
        resource.status = ResourceStatus.COMMUNITY_VERIFIED
    elif rejections >= COMMUNITY_REJECTION_THRESHOLD:
        resource.status = ResourceStatus.REJECTED

    await db.flush()
    return VoteOut(
        resource_id=resource.id, status=resource.status, approval_count=resource.approval_count
    )


async def delete_own_resource(db: AsyncSession, user: User, resource_id: uuid.UUID) -> None:
    """Let the uploader withdraw their own resource (ERS §RF-019).

    Moderators go through ``moderate_resource``; this is the path for someone who uploaded the
    wrong file. Once the community has verified it the resource belongs to everyone, so only a
    moderator can take it down from then on.
    """
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active:
        raise NotFoundError("Recurso no encontrado.")
    if resource.created_by_user_id != user.id and not _can_moderate(user):
        raise ForbiddenError("No puedes eliminar este recurso.")
    if resource.status in _COMMUNITY_OWNED_STATUSES and not _can_moderate(user):
        raise ForbiddenError(
            "Este recurso ya fue verificado por la comunidad. "
            "Pide a un administrador que lo retire."
        )
    await _soft_delete(db, resource)


async def _soft_delete(db: AsyncSession, resource: Resource) -> None:
    """Deactivate the row and drop the stored object; the row stays for referential history."""
    resource.is_active = False
    if resource.object_key:
        await storage.delete_object(resource.object_key)
        resource.object_key = None
    await db.flush()


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
    await _validate_optional_context(
        db, data.get("professor_id"), data.get("academic_period_id")
    )
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
        await _soft_delete(db, resource)
    else:  # pragma: no cover - guarded by the router
        raise ValidationAppError("Acción de moderación inválida.")
    await db.flush()
    return resource


def is_visible_to(resource: Resource, user: User) -> bool:
    """Single definition of resource visibility, shared by every read path."""
    if resource.created_by_user_id == user.id or _can_moderate(user):
        return True
    return resource.status in PUBLICLY_VISIBLE_RESOURCE_STATUSES


async def get_visible_resource(
    db: AsyncSession, user: User, resource_id: uuid.UUID
) -> Resource:
    """Load a resource the caller may see, or 404. Hidden and missing look identical."""
    resource = await crud.get_resource(db, resource_id)
    if resource is None or not resource.is_active or not is_visible_to(resource, user):
        raise NotFoundError("Recurso no encontrado.")
    return resource


async def get_download_url(
    db: AsyncSession, user: User, resource_id: uuid.UUID
) -> tuple[Resource, str | None]:
    resource = await get_visible_resource(db, user, resource_id)
    if resource.kind == ResourceKind.LINK:
        return resource, resource.external_url
    if resource.object_key is None:
        return resource, None
    url = await storage.presigned_get_url(
        resource.object_key, filename=resource.original_filename
    )
    return resource, url
