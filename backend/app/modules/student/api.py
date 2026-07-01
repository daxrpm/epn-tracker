"""Student endpoints: profile, course states, gradebook and calculation (ERS §17.5, §17.6)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.common.deps import CurrentUser, DbSession
from app.common.exception.errors import NotFoundError
from app.modules.student import crud, service
from app.modules.student.schema import (
    CalculateOut,
    ComponentPatchIn,
    CourseStateBulkIn,
    CourseStateOut,
    EnrollmentCreateIn,
    EnrollmentOut,
    GradebookOut,
    GradeItemOut,
    GradReqStateOut,
    GradReqStateUpdateIn,
    ItemCreateIn,
    ItemPatchIn,
    ProfileOut,
    ProfileUpdateIn,
    ProgressOut,
)

router = APIRouter(prefix="/student", tags=["student"])


@router.get("/profile", response_model=ProfileOut)
async def get_profile(user: CurrentUser, db: DbSession) -> ProfileOut:
    profile = await service.get_or_create_profile(db, user)
    return ProfileOut.model_validate(profile)


@router.put("/profile", response_model=ProfileOut)
async def update_profile(payload: ProfileUpdateIn, user: CurrentUser, db: DbSession) -> ProfileOut:
    profile = await service.update_profile(db, user, payload)
    return ProfileOut.model_validate(profile)


@router.get("/progress", response_model=ProgressOut)
async def get_progress(user: CurrentUser, db: DbSession) -> ProgressOut:
    profile = await service.get_or_create_profile(db, user)
    return await service.get_progress(db, profile)


@router.get("/course-states", response_model=list[CourseStateOut])
async def list_course_states(user: CurrentUser, db: DbSession) -> list[CourseStateOut]:
    profile = await service.get_or_create_profile(db, user)
    states = await crud.get_course_states(db, profile.id)
    return [CourseStateOut.model_validate(s) for s in states]


@router.put("/course-states/bulk", response_model=list[CourseStateOut])
async def bulk_course_states(
    payload: CourseStateBulkIn, user: CurrentUser, db: DbSession
) -> list[CourseStateOut]:
    profile = await service.get_or_create_profile(db, user)
    states = await service.bulk_upsert_course_states(db, profile, payload)
    return [CourseStateOut.model_validate(s) for s in states]


@router.get("/graduation-requirements", response_model=list[GradReqStateOut])
async def list_grad_requirements(user: CurrentUser, db: DbSession) -> list[GradReqStateOut]:
    profile = await service.get_or_create_profile(db, user)
    states = await crud.get_grad_req_states(db, profile.id)
    return [GradReqStateOut.model_validate(s) for s in states]


@router.put("/graduation-requirements/{state_id}", response_model=GradReqStateOut)
async def update_grad_requirement(
    state_id: uuid.UUID, payload: GradReqStateUpdateIn, user: CurrentUser, db: DbSession
) -> GradReqStateOut:
    profile = await service.get_or_create_profile(db, user)
    state = await crud.get_grad_req_state(db, state_id)
    if state is None or state.student_profile_id != profile.id:
        raise NotFoundError("Requisito no encontrado.")
    state.state = payload.state
    await db.flush()
    return GradReqStateOut.model_validate(state)


# --- Enrollments and gradebook --------------------------------------------------------------------


@router.get("/enrollments", response_model=list[EnrollmentOut])
async def list_enrollments(user: CurrentUser, db: DbSession) -> list[EnrollmentOut]:
    profile = await service.get_or_create_profile(db, user)
    enrollments = await crud.list_enrollments(db, profile.id)
    return [EnrollmentOut.model_validate(e) for e in enrollments]


@router.post("/enrollments", response_model=EnrollmentOut)
async def create_enrollment(
    payload: EnrollmentCreateIn, user: CurrentUser, db: DbSession
) -> EnrollmentOut:
    profile = await service.get_or_create_profile(db, user)
    enrollment = await service.create_enrollment(db, profile, payload)
    return EnrollmentOut.model_validate(enrollment)


@router.get("/enrollments/{enrollment_id}/gradebook", response_model=GradebookOut)
async def get_gradebook(
    enrollment_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> GradebookOut:
    profile = await service.get_or_create_profile(db, user)
    return await service.get_gradebook(db, profile, enrollment_id)


@router.post("/enrollments/{enrollment_id}/calculate", response_model=CalculateOut)
async def calculate(enrollment_id: uuid.UUID, user: CurrentUser, db: DbSession) -> CalculateOut:
    profile = await service.get_or_create_profile(db, user)
    return await service.calculate(db, profile, enrollment_id)


@router.patch("/grade-components/{component_state_id}")
async def patch_component(
    component_state_id: uuid.UUID, payload: ComponentPatchIn, user: CurrentUser, db: DbSession
) -> dict[str, str]:
    profile = await service.get_or_create_profile(db, user)
    state = await service.patch_component(
        db, profile, component_state_id, mode=payload.mode, direct_score=payload.direct_score
    )
    return {"id": str(state.id), "calculated_score": str(state.calculated_score)}


@router.post("/grade-components/{component_state_id}/items", response_model=GradeItemOut)
async def add_item(
    component_state_id: uuid.UUID, payload: ItemCreateIn, user: CurrentUser, db: DbSession
) -> GradeItemOut:
    profile = await service.get_or_create_profile(db, user)
    item = await service.add_item(
        db,
        profile,
        component_state_id,
        name=payload.name,
        score=payload.score,
        internal_weight_percent=payload.internal_weight_percent,
    )
    return GradeItemOut.model_validate(item)


@router.patch("/grade-items/{item_id}", response_model=GradeItemOut)
async def patch_item(
    item_id: uuid.UUID, payload: ItemPatchIn, user: CurrentUser, db: DbSession
) -> GradeItemOut:
    profile = await service.get_or_create_profile(db, user)
    item = await service.patch_item(db, profile, item_id, payload)
    return GradeItemOut.model_validate(item)


@router.delete("/grade-items/{item_id}")
async def delete_item(item_id: uuid.UUID, user: CurrentUser, db: DbSession) -> dict[str, bool]:
    profile = await service.get_or_create_profile(db, user)
    await service.delete_item(db, profile, item_id)
    return {"deleted": True}
