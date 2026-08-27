"""Shared pagination primitives.

Every collection endpoint is bounded: an unbounded list is a latent denial of service once the
community grows. ``Page`` is the reusable FastAPI dependency; ``DEFAULT_PAGE_SIZE`` is also the
default applied at the crud layer so a service that forgets to pass one still cannot fetch a whole
table.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


@dataclass(slots=True, frozen=True)
class Pagination:
    limit: int
    offset: int


def _pagination(
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


Page = Annotated[Pagination, Depends(_pagination)]
