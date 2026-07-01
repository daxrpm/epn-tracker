"""Seed loader: imports curriculum JSON files through the real import service.

Run with ``uv run python -m seeds.loader``. It uses the same ``commit_import`` path as the admin
endpoint so the data goes through full validation. Re-running skips curricula that already exist.
"""

from __future__ import annotations

import asyncio
import pathlib

from app.common.exception.errors import ValidationAppError
from app.database.db import async_session_factory
from app.database.models import Base  # noqa: F401  (registers every model)
from app.modules.academic.schema import CurriculumImportIn
from app.modules.academic.service import commit_import

DATA_DIR = pathlib.Path(__file__).parent / "data"


async def load_file(path: pathlib.Path) -> None:
    payload = CurriculumImportIn.model_validate_json(path.read_text(encoding="utf-8"))
    async with async_session_factory() as session:
        try:
            result = await commit_import(session, payload)
            await session.commit()
            print(
                f"Loaded {path.name}: curriculum {result.curriculum_id} "
                f"({result.courses_created} courses)"
            )
        except ValidationAppError as exc:
            await session.rollback()
            print(f"Skipped {path.name}: {exc.message}")


async def main() -> None:
    files = sorted(DATA_DIR.glob("*.json"))
    if not files:
        print("No seed files found in", DATA_DIR)
        return
    for path in files:
        await load_file(path)


if __name__ == "__main__":
    asyncio.run(main())
