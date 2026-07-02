from pathlib import Path

import pytest

from app.modules.academic.schema import CurriculumImportIn
from app.modules.academic.service import validate_import

SEED_DIR = Path(__file__).resolve().parents[2] / "seeds" / "data"


@pytest.mark.parametrize(
    ("filename", "course_count", "pensum_year"),
    [
        ("computacion_2020.json", 50, 2020),
        ("software_2020.json", 51, 2020),
        ("sistemas_informacion_2023.json", 51, 2023),
        ("ciencia_datos_ia_2023.json", 52, 2023),
    ],
)
def test_official_curriculum_seed_is_complete(
    filename: str, course_count: int, pensum_year: int
) -> None:
    payload = CurriculumImportIn.model_validate_json(
        (SEED_DIR / filename).read_text(encoding="utf-8")
    )
    validation = validate_import(payload)

    assert validation.valid
    assert not validation.errors
    assert len(payload.courses) == course_count
    assert payload.curriculum.pensum_year == pensum_year
    assert payload.curriculum.total_credits == 135
    assert payload.curriculum.total_terms == 9
    assert {course.reference_term for course in payload.courses} == set(range(1, 10))
    assert len({course.code for course in payload.courses}) == course_count
