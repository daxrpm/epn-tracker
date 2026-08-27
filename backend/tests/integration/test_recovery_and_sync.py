"""The two flows that previously stopped half-way: the makeup exam, and gradebook -> malla.

The recovery rules live in ``app.domain.grading.recovery`` and were already unit-tested; what was
missing was any way to reach them. These tests drive the real HTTP surface end to end.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from tests.factories import (
    API,
    auth,
    calculate,
    create_scheme,
    enroll,
    seed_malla,
    set_all_components,
    student_on,
)

pytestmark = pytest.mark.asyncio


async def _enrolled_student(client, db_session, email: str):
    malla = await seed_malla(client, db_session)
    token = await student_on(client, db_session, email, malla["curriculum_id"])
    scheme_id = await create_scheme(client, token, malla["courses"][0]["course_id"])
    enrollment_id = await enroll(client, token, malla["courses"][0]["id"], scheme_id)
    return token, enrollment_id, malla


async def _course_state(client, token: str, curriculum_course_id: str) -> dict | None:
    resp = await client.get(f"{API}/student/course-states", headers=auth(token))
    assert resp.status_code == 200, resp.text
    for state in resp.json():
        if state["curriculum_course_id"] == curriculum_course_id:
            return state
    return None


# --- Recovery -----------------------------------------------------------------------------------


async def test_a_grade_in_the_recovery_band_reports_what_is_needed(client, db_session):
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "rec1@epn.edu.ec")
    # 11/20 in every component -> 11 per contribution -> 22/40, inside the 18-28 band.
    await set_all_components(client, token, enrollment_id, "11")

    body = await calculate(client, token, enrollment_id)
    assert body["is_complete"] is True
    assert Decimal(body["final_40"]) == Decimal("22")
    assert body["status"] == "RECOVERY_ELIGIBLE"
    # max(24, 48 - 22) = 26
    assert Decimal(body["required_recovery_score_40"]) == Decimal("26")
    assert body["recovery_score_40"] is None
    assert body["recovery_passed"] is None


async def test_passing_the_recovery_approves_the_course(client, db_session):
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "rec2@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "11")

    resp = await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": "30"},
        headers=auth(token),
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["recovery_score_40"]) == Decimal("30")

    body = await calculate(client, token, enrollment_id)
    assert body["recovery_passed"] is True
    assert body["status"] == "APPROVED"
    # (22 + 30) / 2 = 26, which clears the 24 minimum.
    assert Decimal(body["effective_final_40"]) == Decimal("26")
    assert Decimal(body["effective_final_20"]) == Decimal("13")
    # The ordinary grade is still reported unchanged alongside it.
    assert Decimal(body["final_40"]) == Decimal("22")

    state = await _course_state(client, token, malla["courses"][0]["id"])
    assert state["state"] == "PASSED"


async def test_failing_the_recovery_fails_the_course(client, db_session):
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "rec3@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "11")

    resp = await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": "20"},
        headers=auth(token),
    )
    assert resp.status_code == 200, resp.text

    body = await calculate(client, token, enrollment_id)
    # 20 is below the 24 minimum, so it fails regardless of the average.
    assert body["recovery_passed"] is False
    assert body["status"] == "FAILED_DIRECT"

    state = await _course_state(client, token, malla["courses"][0]["id"])
    assert state["state"] == "FAILED"


async def test_recovery_is_refused_when_the_course_is_already_approved(client, db_session):
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "rec4@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "16")  # 32/40, approved outright

    resp = await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": "40"},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert "recuperación" in resp.json()["error"]["message"]


async def test_recovery_is_refused_before_the_ordinary_grade_is_complete(client, db_session):
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "rec5@epn.edu.ec")

    resp = await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": "30"},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_clearing_the_recovery_restores_the_ordinary_outcome(client, db_session):
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "rec6@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "11")
    await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": "30"},
        headers=auth(token),
    )

    cleared = await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": None},
        headers=auth(token),
    )
    assert cleared.status_code == 200, cleared.text

    body = await calculate(client, token, enrollment_id)
    assert body["recovery_score_40"] is None
    assert body["status"] == "RECOVERY_ELIGIBLE"


async def test_a_recovery_score_above_40_is_rejected(client, db_session):
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "rec7@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "11")

    resp = await client.patch(
        f"{API}/student/enrollments/{enrollment_id}/recovery",
        json={"score": "41"},
        headers=auth(token),
    )
    assert resp.status_code == 422


# --- Gradebook -> malla synchronisation ---------------------------------------------------------


async def test_finishing_a_course_marks_it_passed_on_the_malla(client, db_session):
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "sync1@epn.edu.ec")
    curriculum_course_id = malla["courses"][0]["id"]
    assert await _course_state(client, token, curriculum_course_id) is None

    await set_all_components(client, token, enrollment_id, "16")  # 32/40

    state = await _course_state(client, token, curriculum_course_id)
    assert state is not None, "the gradebook never reached the malla"
    assert state["state"] == "PASSED"
    assert Decimal(state["final_score_40"]) == Decimal("32")


async def test_failing_outright_marks_the_course_failed(client, db_session):
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "sync2@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "5")  # 10/40, below the recovery floor

    state = await _course_state(client, token, malla["courses"][0]["id"])
    assert state["state"] == "FAILED"


async def test_a_course_in_the_recovery_band_is_not_decided_yet(client, db_session):
    """18-28/40 is undecided until the recovery score is in, so the malla must not move."""
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "sync3@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "11")  # 22/40

    state = await _course_state(client, token, malla["courses"][0]["id"])
    assert state is None or state["state"] not in ("PASSED", "FAILED")


async def test_a_manual_state_is_not_overwritten_by_the_gradebook(client, db_session):
    """The student's own decision outranks a derived one."""
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "sync4@epn.edu.ec")
    curriculum_course_id = malla["courses"][0]["id"]

    manual = await client.put(
        f"{API}/student/course-states/bulk",
        json={"items": [{"curriculum_course_id": curriculum_course_id, "state": "ANNULLED"}]},
        headers=auth(token),
    )
    assert manual.status_code == 200, manual.text

    await set_all_components(client, token, enrollment_id, "16")  # would otherwise say PASSED

    state = await _course_state(client, token, curriculum_course_id)
    assert state["state"] == "ANNULLED"


async def test_marking_a_course_in_progress_still_lets_the_gradebook_decide_it(client, db_session):
    """IN_PROGRESS is not a decision, so a finished gradebook may replace it."""
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "sync5@epn.edu.ec")
    curriculum_course_id = malla["courses"][0]["id"]

    await client.put(
        f"{API}/student/course-states/bulk",
        json={"items": [{"curriculum_course_id": curriculum_course_id, "state": "IN_PROGRESS"}]},
        headers=auth(token),
    )
    await set_all_components(client, token, enrollment_id, "16")

    state = await _course_state(client, token, curriculum_course_id)
    assert state["state"] == "PASSED"


async def test_updating_the_malla_state_does_not_erase_the_stored_grade(client, db_session):
    """The malla screen omits the score; assigning it blindly used to wipe it."""
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "sync6@epn.edu.ec")
    curriculum_course_id = malla["courses"][0]["id"]
    await set_all_components(client, token, enrollment_id, "16")
    assert Decimal((await _course_state(client, token, curriculum_course_id))["final_score_40"])

    await client.put(
        f"{API}/student/course-states/bulk",
        json={"items": [{"curriculum_course_id": curriculum_course_id, "state": "PASSED"}]},
        headers=auth(token),
    )

    state = await _course_state(client, token, curriculum_course_id)
    assert state["final_score_40"] is not None, "the grade was wiped by a state-only update"


# --- Enrollment lifecycle -----------------------------------------------------------------------


async def test_an_enrollment_can_be_dropped_and_recreated(client, db_session):
    """Picking the wrong course used to be a dead end."""
    token, enrollment_id, malla = await _enrolled_student(client, db_session, "drop@epn.edu.ec")
    curriculum_course_id = malla["courses"][0]["id"]

    dropped = await client.delete(f"{API}/student/enrollments/{enrollment_id}", headers=auth(token))
    assert dropped.status_code == 200, dropped.text

    listing = await client.get(f"{API}/student/enrollments", headers=auth(token))
    assert listing.json() == []

    # And the course is free to be started again with a different scheme.
    other_scheme = await create_scheme(
        client, token, malla["courses"][0]["course_id"], title="Otro paralelo"
    )
    new_id = await enroll(client, token, curriculum_course_id, other_scheme)
    assert new_id != enrollment_id


async def test_dropping_an_enrollment_removes_its_gradebook(client, db_session):
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "drop2@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "16")

    await client.delete(f"{API}/student/enrollments/{enrollment_id}", headers=auth(token))

    gone = await client.get(
        f"{API}/student/enrollments/{enrollment_id}/gradebook", headers=auth(token)
    )
    assert gone.status_code == 404


# --- Calculation is a read ----------------------------------------------------------------------


async def test_calculating_twice_returns_the_same_thing(client, db_session):
    """`calculate` is a GET now; calling it must have no effect on stored state."""
    token, enrollment_id, _ = await _enrolled_student(client, db_session, "pure@epn.edu.ec")
    await set_all_components(client, token, enrollment_id, "14")

    first = await calculate(client, token, enrollment_id)
    second = await calculate(client, token, enrollment_id)
    assert first == second

    projection = await client.get(
        f"{API}/student/enrollments/{enrollment_id}/projection", headers=auth(token)
    )
    assert projection.status_code == 200
    assert await calculate(client, token, enrollment_id) == first
