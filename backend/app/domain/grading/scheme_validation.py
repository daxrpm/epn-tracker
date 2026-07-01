"""Validación de esquemas de evaluación (ERS §8.3).

Un esquema válido tiene exactamente dos aportes (APORTE_1, APORTE_2); cada aporte suma 100%; cada
componente pesa entre 0 y 35%; y (para esquemas de sílabo/RRA) cada aporte tiene al menos un
componente formativo y uno sumativo. Para esquemas personales las últimas reglas producen
advertencias en lugar de errores.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.enums import Contribution, EvaluationType
from app.domain.numeric import to_decimal

MAX_COMPONENT_WEIGHT = Decimal("35")
FULL_WEIGHT = Decimal("100")
DEFAULT_TOLERANCE = Decimal("0.001")


@dataclass(slots=True)
class SchemeComponent:
    contribution: Contribution
    name: str
    weight_percent: Decimal | str
    evaluation_type: EvaluationType = EvaluationType.UNKNOWN


@dataclass(slots=True)
class SchemeIssue:
    field: str
    message: str


@dataclass(slots=True)
class SchemeValidationResult:
    is_valid: bool
    errors: list[SchemeIssue] = field(default_factory=list)
    warnings: list[SchemeIssue] = field(default_factory=list)


def validate_scheme(
    components: list[SchemeComponent],
    *,
    strict: bool = True,
    tolerance: Decimal = DEFAULT_TOLERANCE,
) -> SchemeValidationResult:
    """Valida un esquema. ``strict=True`` para sílabo/admin; ``False`` para esquemas personales.

    En modo no estricto, la ausencia de componentes formativo+sumativo y la suma incompleta se
    reportan como advertencias en lugar de errores.
    """
    errors: list[SchemeIssue] = []
    warnings: list[SchemeIssue] = []

    if not components:
        errors.append(SchemeIssue("components", "El esquema no tiene componentes."))
        return SchemeValidationResult(is_valid=False, errors=errors, warnings=warnings)

    by_contribution: dict[Contribution, list[SchemeComponent]] = {
        Contribution.APORTE_1: [],
        Contribution.APORTE_2: [],
    }
    for idx, comp in enumerate(components):
        weight = to_decimal(comp.weight_percent)
        if weight is None:
            errors.append(SchemeIssue(f"components[{idx}].weight_percent", "Peso inválido."))
            continue
        if weight < Decimal("0") or weight > MAX_COMPONENT_WEIGHT:
            errors.append(
                SchemeIssue(
                    f"components[{idx}].weight_percent",
                    f"El porcentaje debe estar entre 0 y {MAX_COMPONENT_WEIGHT}%.",
                )
            )
        by_contribution[comp.contribution].append(comp)

    for contribution, comps in by_contribution.items():
        if not comps:
            errors.append(SchemeIssue(contribution.value, f"Falta el aporte {contribution.value}."))
            continue

        total = sum((to_decimal(c.weight_percent) or Decimal("0") for c in comps), Decimal("0"))
        if abs(total - FULL_WEIGHT) > tolerance:
            issue = SchemeIssue(
                contribution.value,
                f"El aporte {contribution.value} suma {total}%, debe sumar 100%.",
            )
            (errors if strict else warnings).append(issue)

        types = {c.evaluation_type for c in comps}
        if not (EvaluationType.FORMATIVE in types and EvaluationType.SUMMATIVE in types):
            issue = SchemeIssue(
                contribution.value,
                f"El aporte {contribution.value} debería tener al menos un componente formativo y "
                "uno sumativo.",
            )
            (errors if strict else warnings).append(issue)

    return SchemeValidationResult(
        is_valid=not errors, errors=errors, warnings=warnings
    )
