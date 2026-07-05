"""Create dummy accounts for local testing — one per role.

Run with ``uv run python -m seeds.dummy_users``. Refuses to run outside development so weak,
well-known passwords never reach a real environment. Idempotent: skips accounts that already exist.
All accounts are created pre-verified so you can log in immediately without the email code.
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

# email, password, role. Password is intentionally simple; dev only.
DUMMY_USERS = [
    ("estudiante@epn.edu.ec", "Password123", UserRole.STUDENT),
    ("admin@epn.edu.ec", "Password123", UserRole.ADMIN),
    ("super@epn.edu.ec", "Password123", UserRole.SUPER_ADMIN),
]


async def main() -> None:
    if settings.app_env != "dev":
        print("Refusing to create dummy users outside development (APP_ENV != dev).")
        return
    async with async_session_factory() as session:
        for email, password, role in DUMMY_USERS:
            existing = await crud.get_user_by_email(session, email)
            if existing is not None:
                print(f"{email} already exists (role {existing.role}). Skipping.")
                continue
            user = await crud.create_user(
                session, email=email, password_hash=hash_password(password), role=role
            )
            user.email_verified_at = datetime.now(UTC)
            print(f"Created {role.value:12} {email} / {password}")
        await session.commit()
    print("Done. Log in with any of the accounts above.")


if __name__ == "__main__":
    asyncio.run(main())
