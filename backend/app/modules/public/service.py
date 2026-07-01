"""Servicio de calculadoras anónimas: orquesta el dominio puro (ERS §RF-010, §RF-011)."""

from __future__ import annotations

from app.common.decimal_utils import display_str
from app.domain.grading.grade_calculation import (
    ComponentInput,
    GradeComponentMode,
    calculate_contribution,
    calculate_final,
)
from app.domain.grading.recovery import is_recovery_eligible, required_recovery_score
from app.domain.grading.scheme_validation import SchemeComponent, validate_scheme
from app.modules.public.schema import (
    AnonSchemeIn,
    AnonSchemeOut,
    AportesIn,
    FinalGradeOut,
    RecoveryOut,
)


def calculate_final_grade(payload: AportesIn) -> FinalGradeOut:
    result = calculate_final(payload.aporte_1, payload.aporte_2, is_complete=True)
    required = required_recovery_score(result.final_40)
    return FinalGradeOut(
        final_40=str(result.final_40),
        final_20=str(result.final_20),
        display_final_20=display_str(result.final_20),
        status=result.status,
        is_recovery_eligible=is_recovery_eligible(result.final_40),
        required_recovery_score_40=None if required is None else str(required),
        display_required_recovery_score_40=display_str(required),
    )


def calculate_recovery(payload: AportesIn) -> RecoveryOut:
    result = calculate_final(payload.aporte_1, payload.aporte_2, is_complete=True)
    required = required_recovery_score(result.final_40)
    return RecoveryOut(
        final_40=str(result.final_40),
        final_20=str(result.final_20),
        display_final_20=display_str(result.final_20),
        status=result.status,
        required_recovery_score_40=None if required is None else str(required),
        display_required_recovery_score_40=display_str(required),
    )


def calculate_anon_scheme(payload: AnonSchemeIn) -> AnonSchemeOut:
    """Calcula una materia temporal con componentes y pesos, sin guardar (ERS §RF-011)."""
    validation = validate_scheme(
        [
            SchemeComponent(
                contribution=c.contribution,
                name=c.name,
                weight_percent=c.weight_percent,
                evaluation_type=c.evaluation_type,
            )
            for c in payload.components
        ],
        strict=False,
    )

    aportes: dict[str, list[ComponentInput]] = {"APORTE_1": [], "APORTE_2": []}
    for c in payload.components:
        aportes[c.contribution.value].append(
            ComponentInput(
                weight_percent=c.weight_percent,
                mode=GradeComponentMode.DIRECT_SCORE,
                direct_score=c.score,
            )
        )

    a1 = calculate_contribution(aportes["APORTE_1"])
    a2 = calculate_contribution(aportes["APORTE_2"])
    is_complete = a1.is_complete and a2.is_complete
    final = calculate_final(a1.score_20, a2.score_20, is_complete=is_complete)

    return AnonSchemeOut(
        aporte_1_score_20=str(a1.score_20),
        aporte_2_score_20=str(a2.score_20),
        final_40=str(final.final_40),
        final_20=str(final.final_20),
        display_final_20=display_str(final.final_20) or "0.00",
        status=final.status,
        is_valid=validation.is_valid,
        warnings=[w.message for w in validation.warnings],
    )
