"""DTOs for study resources (recursos)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.common.enums import (
    Contribution,
    ResourceKind,
    ResourceStatus,
    SchemeVote,
    Visibility,
)

#: Only these schemes may be stored as a resource link. The value is rendered as an ``href`` in
#: the viewer, so ``javascript:`` and ``data:`` would be a stored cross-site scripting vector.
_ALLOWED_URL_SCHEMES = ("http://", "https://")
_MAX_URL_LENGTH = 2048


def _validate_external_url(value: str) -> str:
    url = value.strip()
    if len(url) > _MAX_URL_LENGTH:
        raise ValueError("El enlace es demasiado largo.")
    if not url.lower().startswith(_ALLOWED_URL_SCHEMES):
        raise ValueError("El enlace debe empezar con http:// o https://.")
    return url


class LinkResourceCreateIn(BaseModel):
    """JSON body for a LINK resource (Drive/YouTube/URL — no file upload)."""

    course_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    external_url: str = Field(min_length=1, max_length=_MAX_URL_LENGTH)
    description: str | None = Field(default=None, max_length=2000)
    tema: str | None = Field(default=None, max_length=255)
    contribution: Contribution | None = None
    professor_id: uuid.UUID | None = None
    academic_period_id: uuid.UUID | None = None
    visibility: Visibility = Visibility.COMMUNITY

    @field_validator("external_url")
    @classmethod
    def _url_scheme(cls, v: str) -> str:
        return _validate_external_url(v)


class ResourceUpdateIn(BaseModel):
    """Editable metadata (owner or admin). Advanced options include year/professor."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    tema: str | None = Field(default=None, max_length=255)
    contribution: Contribution | None = None
    professor_id: uuid.UUID | None = None
    academic_period_id: uuid.UUID | None = None


class ResourceListItem(BaseModel):
    """Lean row for the consultation panel (no download URL / extracted text)."""

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: str | None = None
    tema: str | None = None
    kind: ResourceKind
    contribution: Contribution | None = None
    status: ResourceStatus
    visibility: Visibility
    approval_count: int
    professor_id: uuid.UUID | None = None
    professor_name: str | None = None
    academic_period_id: uuid.UUID | None = None
    academic_period_code: str | None = None
    original_filename: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    external_url: str | None = None
    created_by_user_id: uuid.UUID | None = None
    is_owner: bool = False
    created_at: datetime


class ResourceDetail(ResourceListItem):
    """Full detail: adds the resolved course info and a presigned download URL."""

    course_code: str | None = None
    course_name: str | None = None
    can_moderate: bool = False
    download_url: str | None = None


class ResourceCreateOut(BaseModel):
    id: uuid.UUID
    status: ResourceStatus
    kind: ResourceKind


class VoteIn(BaseModel):
    vote: SchemeVote = SchemeVote.APPROVE


class VoteOut(BaseModel):
    resource_id: uuid.UUID
    status: ResourceStatus
    approval_count: int
