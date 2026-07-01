"""Bootstrap the first super admin.

Run with ``uv run python -m seeds.create_admin``. Reads ``FIRST_SUPERADMIN_EMAIL`` and
``FIRST_SUPERADMIN_PASSWORD`` from the environment. Idempotent: skips if the user already exists.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from app.common.enums import UserRole
from app.common.security.password import hash_password
from app.core.conf import settings
from app.database.db import async_session_factory
from app.database.models import Base  # noqa: F401  (registers every model)
from app.modules.iam import crud


async def create_superadmin(email: str, password: str) -> None:
    email = email.lower()
    async with async_session_factory() as session:
        existing = await crud.get_user_by_email(session, email)
        if existing is not None:
            print(f"User {email} already exists (role {existing.role}). Skipping.")
            return
        user = await crud.create_user(
            session,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.SUPER_ADMIN,
        )
        user.email_verified_at = datetime.now(UTC)
        await session.commit()
        print(f"Created super admin {email}.")


async def main() -> None:
    email = settings.first_superadmin_email
    password = settings.first_superadmin_password
    if not email or not password:
        print(
            "Set FIRST_SUPERADMIN_EMAIL and FIRST_SUPERADMIN_PASSWORD to bootstrap an admin. "
            "Skipping."
        )
        return
    await create_superadmin(email, password)


if __name__ == "__main__":
    asyncio.run(main())
