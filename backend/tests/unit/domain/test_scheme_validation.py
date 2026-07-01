"""Tests de validación de esquemas de evaluación (ERS §8.3, §24.3, CA-004/005)."""

from app.domain.enums import Contribution, EvaluationType
from app.domain.grading.scheme_validation import SchemeComponent, validate_scheme


def _full_scheme() -> list[SchemeComponent]:
    return [
        SchemeComponent(Contribution.APORTE_1, "Prueba 1", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_1, "Prueba 2", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_1, "Trabajos", "30", EvaluationType.FORMATIVE),
        SchemeComponent(Contribution.APORTE_1, "Deberes", "10", EvaluationType.FORMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Prueba 3", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Prueba 4", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Trabajos", "30", EvaluationType.FORMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Deberes", "10", EvaluationType.FORMATIVE),
    ]


def test_valid_scheme():
    result = validate_scheme(_full_scheme(), strict=True)
    assert result.is_valid is True
    assert result.errors == []


def test_ca_004_aporte_sums_90_invalid_strict():
    comps = [
        SchemeComponent(Contribution.APORTE_1, "Prueba", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_1, "Deberes", "30", EvaluationType.FORMATIVE),
        SchemeComponent(Contribution.APORTE_1, "Trabajos", "30", EvaluationType.FORMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Prueba", "35", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Examen", "35", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Deberes", "30", EvaluationType.FORMATIVE),
    ]
    result = validate_scheme(comps, strict=True)
    assert result.is_valid is False
    assert any("APORTE_1" in e.field for e in result.errors)


def test_ca_005_component_over_35_invalid():
    comps = [
        SchemeComponent(Contribution.APORTE_1, "Examen", "40", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_1, "Deberes", "60", EvaluationType.FORMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Examen", "40", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Deberes", "60", EvaluationType.FORMATIVE),
    ]
    result = validate_scheme(comps, strict=True)
    assert result.is_valid is False
    assert any("weight_percent" in e.field for e in result.errors)


def test_personal_scheme_incomplete_is_warning_not_error():
    # Un solo aporte, sin sumar 100: en modo no estricto son advertencias, no bloquea.
    comps = [
        SchemeComponent(Contribution.APORTE_1, "Examen", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Examen", "30", EvaluationType.SUMMATIVE),
    ]
    result = validate_scheme(comps, strict=False)
    assert result.is_valid is True
    assert result.warnings
