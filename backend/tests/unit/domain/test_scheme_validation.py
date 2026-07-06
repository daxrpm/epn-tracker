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
    # Contributions not summing to 100: in non-strict mode these are warnings, not blocking.
    comps = [
        SchemeComponent(Contribution.APORTE_1, "Examen", "30", EvaluationType.SUMMATIVE),
        SchemeComponent(Contribution.APORTE_2, "Examen", "30", EvaluationType.SUMMATIVE),
    ]
    result = validate_scheme(comps, strict=False)
    assert result.is_valid is True
    assert result.warnings


def test_two_decimal_99_99_total_is_accepted_as_100():
    components = []
    for contribution in (Contribution.APORTE_1, Contribution.APORTE_2):
        components.extend(
            [
                SchemeComponent(contribution, "Prueba", "33.33", EvaluationType.SUMMATIVE),
                SchemeComponent(contribution, "Deberes", "33.33", EvaluationType.FORMATIVE),
                SchemeComponent(contribution, "Examen", "33.33", EvaluationType.SUMMATIVE),
            ]
        )

    result = validate_scheme(components, strict=True)

    assert result.is_valid is True
    assert result.errors == []


def test_total_above_100_is_not_accepted_by_tolerance():
    components = _full_scheme()
    components[0].weight_percent = "30.01"

    result = validate_scheme(components, strict=True)

    assert result.is_valid is False
    assert any("APORTE_1" in error.field for error in result.errors)
