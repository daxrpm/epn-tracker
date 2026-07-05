"""Authentication endpoints (ERS §17.1) and superadmin user management (ERS §5.4)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.common.deps import CurrentUser, DbSession, require_super_admin
from app.modules.iam import admin_service, service
from app.modules.iam.schema import (
    AdminUserCreateIn,
    AdminUserOut,
    LoginIn,
    LogoutIn,
    MessageOut,
    RefreshIn,
    RequestCodeIn,
    RoleUpdateIn,
    StatusUpdateIn,
    TokenOut,
    UserOut,
    VerifyCodeIn,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register/request-code", response_model=MessageOut)
async def request_code(payload: RequestCodeIn, db: DbSession) -> MessageOut:
    await service.request_verification_code(db, payload.email)
    # Neutral message: never reveals whether the account exists (ERS §RF-001).
    return MessageOut(message="Si el correo es válido, enviamos un código de verificación.")


@router.post("/register/verify-code", response_model=TokenOut)
async def verify_code(payload: VerifyCodeIn, db: DbSession) -> TokenOut:
    return await service.verify_code_and_register(
        db, payload.email, payload.code, payload.password
    )


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: DbSession) -> TokenOut:
    return await service.login(db, payload.email, payload.password)


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshIn) -> TokenOut:
    return await service.refresh_tokens(payload.refresh_token)


@router.post("/logout", response_model=MessageOut)
async def logout(payload: LogoutIn) -> MessageOut:
    await service.logout(payload.refresh_token)
    return MessageOut(message="Sesión cerrada.")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


# --- Superadmin: user & role management ---------------------------------------------------------
# The whole router requires SUPER_ADMIN; the service enforces self-protection and last-superadmin.

admin_users_router = APIRouter(
    prefix="/admin/users",
    tags=["admin-users"],
    dependencies=[Depends(require_super_admin)],
)


@admin_users_router.get("", response_model=list[AdminUserOut])
async def list_users(db: DbSession) -> list[AdminUserOut]:
    return [AdminUserOut.model_validate(u) for u in await admin_service.list_users(db)]


@admin_users_router.post("", response_model=AdminUserOut)
async def create_user(
    payload: AdminUserCreateIn, actor: CurrentUser, db: DbSession
) -> AdminUserOut:
    return AdminUserOut.model_validate(await admin_service.create_user(db, actor, payload))


@admin_users_router.patch("/{user_id}/role", response_model=AdminUserOut)
async def update_role(
    user_id: uuid.UUID, payload: RoleUpdateIn, actor: CurrentUser, db: DbSession
) -> AdminUserOut:
    return AdminUserOut.model_validate(
        await admin_service.update_role(db, actor, user_id, payload.role)
    )


@admin_users_router.patch("/{user_id}/status", response_model=AdminUserOut)
async def update_status(
    user_id: uuid.UUID, payload: StatusUpdateIn, actor: CurrentUser, db: DbSession
) -> AdminUserOut:
    return AdminUserOut.model_validate(
        await admin_service.update_status(db, actor, user_id, payload.status)
    )


@admin_users_router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID, actor: CurrentUser, db: DbSession
) -> dict[str, bool]:
    await admin_service.delete_user(db, actor, user_id)
    return {"deleted": True}
