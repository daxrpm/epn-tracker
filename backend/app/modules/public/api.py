"""Public endpoints: anonymous calculators (ERS §17.11). No authentication required."""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.public import service
from app.modules.public.schema import (
    AnonSchemeIn,
    AnonSchemeOut,
    AportesIn,
    FinalGradeOut,
    RecoveryOut,
)

router = APIRouter(prefix="/public", tags=["public"])


@router.post("/calculators/final-grade", response_model=FinalGradeOut)
async def final_grade(payload: AportesIn) -> FinalGradeOut:
    return service.calculate_final_grade(payload)


@router.post("/calculators/recovery", response_model=RecoveryOut)
async def recovery(payload: AportesIn) -> RecoveryOut:
    return service.calculate_recovery(payload)


@router.post("/calculators/scheme", response_model=AnonSchemeOut)
async def scheme(payload: AnonSchemeIn) -> AnonSchemeOut:
    return service.calculate_anon_scheme(payload)
