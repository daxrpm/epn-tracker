"""Seed loader: imports curriculum JSON files through the real import service.

Run with ``uv run python -m seeds.loader``. It uses the same ``commit_import`` path as the admin
endpoint so the data goes through full validation. Re-running skips curricula that already exist.
"""

from __future__ import annotations

import argparse
import asyncio
import pathlib

from sqlalchemy import delete, func, select

from app.common.enums import CurriculumStatus
from app.common.exception.errors import ValidationAppError
from app.database.db import async_session_factory
from app.database.models import Base  # noqa: F401  (registers every model)
from app.modules.academic import service as academic_service
from app.modules.academic.model import (
    Career,
    CourseRequirement,
    Curriculum,
    CurriculumCourse,
    CurriculumGraduationRequirement,
    Faculty,
    Institution,
)
from app.modules.academic.schema import CurriculumImportIn
from app.modules.academic.service import commit_import
from app.modules.student.model import StudentCourseState, StudentEnrollment

DATA_DIR = pathlib.Path(__file__).parent / "data"


async def load_file(path: pathlib.Path, *, replace_incomplete: bool = False) -> None:
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
            if replace_incomplete and "Ya existe un pénsum" in exc.message:
                replaced = await replace_incomplete_curriculum(session, payload)
                if replaced:
                    await session.commit()
                    print(f"Updated {path.name}: existing incomplete curriculum replaced")
                else:
                    await session.rollback()
                    print(f"Skipped {path.name}: existing curriculum is already complete")
            else:
                print(f"Skipped {path.name}: {exc.message}")


async def replace_incomplete_curriculum(session, payload: CurriculumImportIn) -> bool:
    """Replace only a count-mismatched seed while retaining its curriculum primary key.

    This operation refuses to run when course progress or enrollments exist. It is intended to
    upgrade early development seeds, not to rewrite production academic history.
    """
    result = await session.execute(
        select(Curriculum)
        .join(Career, Career.id == Curriculum.career_id)
        .join(Faculty, Faculty.id == Career.faculty_id)
        .join(Institution, Institution.id == Faculty.institution_id)
        .where(
            Institution.acronym == payload.institution.acronym,
            Career.name == payload.career.name,
            Curriculum.pensum_year == payload.curriculum.pensum_year,
        )
    )
    curriculum = result.scalar_one_or_none()
    if curriculum is None:
        return False

    course_ids = select(CurriculumCourse.id).where(CurriculumCourse.curriculum_id == curriculum.id)
    current_count = (
        await session.execute(
            select(func.count(CurriculumCourse.id)).where(
                CurriculumCourse.curriculum_id == curriculum.id
            )
        )
    ).scalar_one()
    current_requirement_count = (
        await session.execute(
            select(func.count(CourseRequirement.id)).where(
                CourseRequirement.curriculum_course_id.in_(course_ids)
            )
        )
    ).scalar_one()
    expected_requirement_count = sum(len(course.requirements) for course in payload.courses)
    if (
        current_count == len(payload.courses)
        and current_requirement_count == expected_requirement_count
    ):
        return False

    state_count = (
        await session.execute(
            select(func.count(StudentCourseState.id)).where(
                StudentCourseState.curriculum_course_id.in_(course_ids)
            )
        )
    ).scalar_one()
    enrollment_count = (
        await session.execute(
            select(func.count(StudentEnrollment.id)).where(
                StudentEnrollment.curriculum_course_id.in_(course_ids)
            )
        )
    ).scalar_one()
    if state_count or enrollment_count:
        raise ValidationAppError(
            "No se puede reemplazar una malla con progreso o matrículas existentes."
        )

    await session.execute(
        delete(CurriculumGraduationRequirement).where(
            CurriculumGraduationRequirement.curriculum_id == curriculum.id
        )
    )
    await session.execute(
        delete(CurriculumCourse).where(CurriculumCourse.curriculum_id == curriculum.id)
    )
    await session.flush()

    curriculum.name = f"Pénsum {payload.curriculum.pensum_year}"
    curriculum.total_credits = payload.curriculum.total_credits
    curriculum.total_hours = payload.curriculum.total_hours
    curriculum.total_terms = payload.curriculum.total_terms
    curriculum.total_courses_reported = payload.curriculum.total_courses_reported
    curriculum.status = CurriculumStatus.ACTIVE

    institution = (
        await session.execute(
            select(Institution).where(Institution.acronym == payload.institution.acronym)
        )
    ).scalar_one()
    code_to_cc = await academic_service._create_curriculum_courses(  # noqa: SLF001
        session, curriculum, institution.id, payload
    )
    academic_service._link_requirements(session, code_to_cc, payload)  # noqa: SLF001
    await academic_service._link_graduation_requirements(  # noqa: SLF001
        session, curriculum, institution.id, payload
    )
    await session.flush()
    return True


async def main(*, replace_incomplete: bool = False) -> None:
    files = sorted(DATA_DIR.glob("*.json"))
    if not files:
        print("No seed files found in", DATA_DIR)
        return
    for path in files:
        await load_file(path, replace_incomplete=replace_incomplete)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--replace-incomplete",
        action="store_true",
        help="replace count-mismatched development seeds when they have no student progress",
    )
    args = parser.parse_args()
    asyncio.run(main(replace_incomplete=args.replace_incomplete))
