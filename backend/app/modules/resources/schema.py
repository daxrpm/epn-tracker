"""DTOs for study resources (recursos)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.common.enums import (
    Contribution,
    ResourceKind,
    ResourceStatus,
    SchemeVote,
    Visibility,
)


class LinkResourceCreateIn(BaseModel):
    """JSON body for a LINK resource (Drive/YouTube/URL — no file upload)."""

    course_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    external_url: str = Field(min_length=1)
    description: str | None = None
    tema: str | None = Field(default=None, max_length=255)
    contribution: Contribution | None = None
    professor_id: uuid.UUID | None = None
    academic_period_id: uuid.UUID | None = None
    visibility: Visibility = Visibility.COMMUNITY


class ResourceUpdateIn(BaseModel):
    """Editable metadata (owner or admin). Advanced options include year/professor."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
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
