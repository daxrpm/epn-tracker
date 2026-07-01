"""Grade calculation: component -> contribution -> final ordinary grade (ERS §8.2, §8.4, §16).

Pure functions operating on ``Decimal``. No database or FastAPI dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.enums import CourseFinalStatus, GradeComponentMode
from app.domain.numeric import ZERO, to_decimal

APPROVED_THRESHOLD_40 = Decimal("28")
RECOVERY_FLOOR_40 = Decimal("18")
FULL_WEIGHT = Decimal("100")


@dataclass(slots=True)
class ItemInput:
    """An internal item within a component (e.g. Homework 1)."""

    score: Decimal | str | None = None
    internal_weight_percent: Decimal | str | None = None


@dataclass(slots=True)
class ComponentInput:
    """An evaluation component with its calculation mode and items."""

    weight_percent: Decimal | str
    mode: GradeComponentMode = GradeComponentMode.EQUAL_AVERAGE
    direct_score: Decimal | str | None = None
    items: list[ItemInput] = field(default_factory=list)

    @property
    def calculated_score(self) -> Decimal | None:
        return calculate_component_score(self.mode, self.direct_score, self.items)


@dataclass(slots=True)
class ContributionResult:
    score_20: Decimal
    evaluated_weight_percent: Decimal
    is_complete: bool


@dataclass(slots=True)
class FinalResult:
    final_40: Decimal
    final_20: Decimal
    status: CourseFinalStatus
    is_complete: bool


def calculate_component_score(
    mode: GradeComponentMode,
    direct_score: Decimal | str | None,
    items: list[ItemInput],
) -> Decimal | None:
    """Score of a single component (scale 20) according to its mode (ERS §8.8, §16.1)."""
    if mode == GradeComponentMode.DIRECT_SCORE:
        return to_decimal(direct_score)

    valid = [it for it in items if to_decimal(it.score) is not None]
    if not valid:
        return None

    if mode == GradeComponentMode.EQUAL_AVERAGE:
        total = sum((to_decimal(it.score) for it in valid), start=ZERO)
        return total / Decimal(len(valid))

    if mode == GradeComponentMode.CUSTOM_WEIGHTS:
        total_weight = sum(
            (to_decimal(it.internal_weight_percent) or ZERO for it in valid), start=ZERO
        )
        if total_weight == ZERO:
            return None
        weighted = ZERO
        for it in valid:
            item_weight = to_decimal(it.internal_weight_percent) or ZERO
            weighted += to_decimal(it.score) * item_weight / FULL_WEIGHT
        # Normalise by the registered weight to support partially filled items.
        return weighted * FULL_WEIGHT / total_weight

    raise ValueError(f"Unsupported component mode: {mode}")


def calculate_contribution(components: list[ComponentInput]) -> ContributionResult:
    """Score of a contribution (scale 20) from its components (ERS §8.2, §16.2).

    Only components that have a score are added; the evaluated weight is reported for the 'current'
    and 'projection' views (ERS §8.7).
    """
    total = ZERO
    evaluated_weight = ZERO

    for component in components:
        score = component.calculated_score
        if score is None:
            continue
        weight = to_decimal(component.weight_percent) or ZERO
        total += score * weight / FULL_WEIGHT
        evaluated_weight += weight

    return ContributionResult(
        score_20=total,
        evaluated_weight_percent=evaluated_weight,
        is_complete=evaluated_weight == FULL_WEIGHT,
    )


def determine_status(final_40: Decimal, is_complete: bool) -> CourseFinalStatus:
    """Academic status from the final grade over 40 (ERS §8.4, §16.3)."""
    if not is_complete:
        return CourseFinalStatus.IN_PROGRESS
    if final_40 >= APPROVED_THRESHOLD_40:
        return CourseFinalStatus.APPROVED
    if final_40 >= RECOVERY_FLOOR_40:
        return CourseFinalStatus.RECOVERY_ELIGIBLE
    return CourseFinalStatus.FAILED_DIRECT


def calculate_final(
    aporte_1_score_20: Decimal | str,
    aporte_2_score_20: Decimal | str,
    is_complete: bool = True,
) -> FinalResult:
    """Final ordinary grade: ``final_40 = aporte_1 + aporte_2`` (ERS §8.4)."""
    a1 = to_decimal(aporte_1_score_20) or ZERO
    a2 = to_decimal(aporte_2_score_20) or ZERO
    final_40 = a1 + a2
    final_20 = final_40 / Decimal("2")
    return FinalResult(
        final_40=final_40,
        final_20=final_20,
        status=determine_status(final_40, is_complete),
        is_complete=is_complete,
    )
