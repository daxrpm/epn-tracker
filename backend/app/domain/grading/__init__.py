"""Reglas de dominio de notas: componentes, aportes, nota final y recuperación."""

from app.domain.grading.grade_calculation import (
    ComponentInput,
    ContributionResult,
    FinalResult,
    ItemInput,
    calculate_component_score,
    calculate_contribution,
    calculate_final,
    determine_status,
)
from app.domain.grading.recovery import (
    RecoveryResult,
    evaluate_recovery,
    improved_final_with_recovery,
    is_recovery_eligible,
    required_recovery_score,
)
from app.domain.grading.scheme_validation import (
    SchemeComponent,
    SchemeValidationResult,
    validate_scheme,
)

__all__ = [
    "ComponentInput",
    "ContributionResult",
    "FinalResult",
    "ItemInput",
    "RecoveryResult",
    "SchemeComponent",
    "SchemeValidationResult",
    "calculate_component_score",
    "calculate_contribution",
    "calculate_final",
    "determine_status",
    "evaluate_recovery",
    "improved_final_with_recovery",
    "is_recovery_eligible",
    "required_recovery_score",
    "validate_scheme",
]
