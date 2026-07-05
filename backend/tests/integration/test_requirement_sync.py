"""The progress-safe requirement re-sync updates prereq edges without wiping student progress."""

import pytest
from sqlalchemy import func, select

from app.common.enums import CourseState, UserRole
from app.modules.academic.model import Course, CourseRequirement, CurriculumCourse
from app.modules.academic.schema import CurriculumImportIn
from app.modules.academic.service import commit_import
from app.modules.iam.model import User
from app.modules.student.model import StudentCourseState, StudentProfile
from seeds.loader import sync_requirements

pytestmark = pytest.mark.asyncio


def _course(code, name, term, credits, requirements=None):
    return {
        "code": code, "name": name, "credits": credits, "hours": 144,
        "reference_term": term, "organization_unit": "PROFESSIONAL",
        "requirements": requirements or [],
    }


def _malla(requirements_for_523):
    return {
        "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
        "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
        "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
        "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "9",
                       "total_hours": 0},
        "courses": [
            _course("ICCD442", "Estructuras II", 4, "3"),
            _course("ICCD523", "Inteligencia Artificial", 5, "3", requirements_for_523),
            _course("ICCD814", "Modelos y Simulación", 8, "3"),
        ],
        "graduation_requirements": [],
    }


async def _cc_ids(db, curriculum_id):
    rows = (
        await db.execute(
            select(Course.code, CurriculumCourse.id).join(
                Course, Course.id == CurriculumCourse.course_id
            ).where(CurriculumCourse.curriculum_id == curriculum_id)
        )
    ).all()
    return dict(rows)


async def test_sync_adds_missing_prereq_and_keeps_progress(db_session):
    # Import a malla where IA has no prerequisite yet.
    result = await commit_import(db_session, CurriculumImportIn.model_validate(_malla([])))
    await db_session.flush()
    before = await _cc_ids(db_session, result.curriculum_id)

    # A student has already passed Estructuras II.
    user = User(email="s@epn.edu.ec", role=UserRole.STUDENT)
    db_session.add(user)
    await db_session.flush()
    profile = StudentProfile(user_id=user.id, current_curriculum_id=result.curriculum_id)
    db_session.add(profile)
    await db_session.flush()
    db_session.add(
        StudentCourseState(
            student_profile_id=profile.id,
            curriculum_course_id=before["ICCD442"],
            state=CourseState.PASSED,
        )
    )
    await db_session.flush()

    # Re-sync from a corrected seed: IA now requires Estructuras II.
    payload = CurriculumImportIn.model_validate(
        _malla([{"type": "PREREQUISITE", "course_code": "ICCD442"}])
    )
    count = await sync_requirements(db_session, payload)
    await db_session.flush()
    assert count == 1

    # Curriculum courses are untouched (same ids) — so the student state still points at a live row.
    assert await _cc_ids(db_session, result.curriculum_id) == before
    surviving = (
        await db_session.execute(select(func.count(StudentCourseState.id)))
    ).scalar_one()
    assert surviving == 1

    # The new prerequisite edge exists: IA <- Estructuras II.
    edge = (
        await db_session.execute(
            select(CourseRequirement).where(
                CourseRequirement.curriculum_course_id == before["ICCD523"],
                CourseRequirement.required_curriculum_course_id == before["ICCD442"],
            )
        )
    ).scalar_one_or_none()
    assert edge is not None


async def test_sync_removes_stale_edge(db_session):
    # Import with a (wrong) prereq, then sync a seed that drops it.
    await commit_import(
        db_session,
        CurriculumImportIn.model_validate(
            _malla([{"type": "PREREQUISITE", "course_code": "ICCD442"}])
        ),
    )
    await db_session.flush()

    count = await sync_requirements(db_session, CurriculumImportIn.model_validate(_malla([])))
    await db_session.flush()
    assert count == 0
    total = (
        await db_session.execute(select(func.count(CourseRequirement.id)))
    ).scalar_one()
    assert total == 0
