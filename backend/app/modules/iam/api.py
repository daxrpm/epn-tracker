"""Authentication endpoints (ERS §17.1)."""

from __future__ import annotations

from fastapi import APIRouter

from app.common.deps import CurrentUser, DbSession
from app.modules.iam import service
from app.modules.iam.schema import (
    LoginIn,
    LogoutIn,
    MessageOut,
    RefreshIn,
    RequestCodeIn,
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
