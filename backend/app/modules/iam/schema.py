"""Schemas (DTOs) for the identity and access module."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.common.enums import UserRole, UserStatus
from app.core.conf import settings


def _validate_epn_domain(email: str) -> str:
    email = email.strip().lower()
    domain = settings.allowed_email_domain.lower()
    if not email.endswith(f"@{domain}"):
        raise ValueError(f"El correo debe terminar en @{domain}.")
    return email


class RequestCodeIn(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _domain(cls, v: str) -> str:
        return _validate_epn_domain(v)


class VerifyCodeIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _domain(cls, v: str) -> str:
        return _validate_epn_domain(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def _domain(cls, v: str) -> str:
        return _validate_epn_domain(v)


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str | None = None


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MessageOut(BaseModel):
    message: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    is_verified: bool

    model_config = {"from_attributes": True}


# --- Superadmin: user & role management (ERS §5.4) ----------------------------------------------


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    status: UserStatus
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.ADMIN

    @field_validator("email")
    @classmethod
    def _domain(cls, v: str) -> str:
        return _validate_epn_domain(v)


class RoleUpdateIn(BaseModel):
    role: UserRole


class StatusUpdateIn(BaseModel):
    status: UserStatus = Field(description="ACTIVE o SUSPENDED")

    @field_validator("status")
    @classmethod
    def _not_deleted(cls, v: UserStatus) -> UserStatus:
        if v == UserStatus.DELETED:
            raise ValueError("Usa el endpoint DELETE para eliminar una cuenta.")
        return v
