"""Small SQL helpers shared by the crud layer."""

from __future__ import annotations

#: Backslash-escaping for ``LIKE``/``ILIKE`` patterns. Without it a user typing ``%`` turns their
#: search into a match-everything wildcard, and ``_`` silently matches any character.
_LIKE_SPECIALS = str.maketrans({"\\": r"\\", "%": r"\%", "_": r"\_"})


def escape_like(term: str) -> str:
    """Escape a user-supplied term for safe interpolation into a ``LIKE`` pattern.

    Pair it with ``escape="\\\\"`` on the SQLAlchemy ``like``/``ilike`` call.
    """
    return term.translate(_LIKE_SPECIALS)
