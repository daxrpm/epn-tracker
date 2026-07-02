"""Grade projection: what does the student still need to reach a target? (ERS §8.7, §RF-009).

Pure functions operating on ``Decimal``. No database or FastAPI dependencies.

The final grade is scored over 40. Each of the two contributions (APORTE_1, APORTE_2) has components
whose weights sum to 100, so across both contributions the evaluated weight adds up to 200 and:

    final_40 = sum over all components of (component_score_20 * weight_percent / 100)
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.domain.enums import Contribution
from app.domain.numeric import ZERO, to_decimal

FULL_WEIGHT = Decimal("100")
TOTAL_WEIGHT = Decimal("200")
MAX_SCORE_20 = Decimal("20")
DEFAULT_TARGET_FINAL_40 = Decimal("28")


@dataclass(slots=True)
class ProjectionComponent:
    """A single evaluation component for projection purposes."""

    contribution: Contribution
    weight_percent: Decimal | str
    calculated_score: Decimal | str | None = None


@dataclass(slots=True)
class ProjectionResult:
    target_final_40: Decimal
    current_points_40: Decimal
    evaluated_weight_percent: Decimal
    remaining_weight_percent: Decimal
    required_avg_score_20: Decimal | None
    already_reached: bool
    is_reachable: bool


def project_target(
    components: list[ProjectionComponent],
    target_final_40: Decimal | str = DEFAULT_TARGET_FINAL_40,
) -> ProjectionResult:
    """Compute how far the student is from ``target_final_40`` and what is still required.

    - ``current_points_40``: points already secured out of 40 from scored components.
    - ``evaluated_weight_percent``: weight (out of 200) of components that have a score.
    - ``remaining_weight_percent``: weight of the real components that still lack a score.
    - ``required_avg_score_20``: average /20 needed on the remaining weighted components to reach
      the target; ``None`` when there is no remaining weight.
    - ``already_reached``: the secured points already meet the target.
    - ``is_reachable``: the required average is attainable (<= 20), or the target is already met.
    """
    target = to_decimal(target_final_40) or ZERO

    current_points_40 = ZERO
    evaluated_weight = ZERO
    remaining_weight = ZERO

    for component in components:
        weight = to_decimal(component.weight_percent) or ZERO
        score = to_decimal(component.calculated_score)
        if score is None:
            remaining_weight += weight
        else:
            current_points_40 += score * weight / FULL_WEIGHT
            evaluated_weight += weight

    already_reached = current_points_40 >= target

    if remaining_weight == ZERO:
        required_avg_score_20 = None
        is_reachable = already_reached
    else:
        required_avg_score_20 = (target - current_points_40) * FULL_WEIGHT / remaining_weight
        is_reachable = required_avg_score_20 <= MAX_SCORE_20

    return ProjectionResult(
        target_final_40=target,
        current_points_40=current_points_40,
        evaluated_weight_percent=evaluated_weight,
        remaining_weight_percent=remaining_weight,
        required_avg_score_20=required_avg_score_20,
        already_reached=already_reached,
        is_reachable=is_reachable,
    )
