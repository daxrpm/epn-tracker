"""Request-context middleware: assigns a request-id and logs access (ERS §RNF-008)."""

from __future__ import annotations

import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.conf import settings
from app.core.logging import get_logger

logger = get_logger("app.access")

# Conservative security headers applied to every response (defense in depth).
#
# The API serves JSON and user-uploaded bytes, never HTML of its own, so the CSP can be maximally
# restrictive: nothing may be loaded, framed or executed from an API response. That neutralises a
# spoofed ``Content-Type`` on an uploaded file (ERS §25.5).
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "0",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; sandbox"
    ),
    "Cross-Origin-Resource-Policy": "same-site",
}

#: Only a short opaque token is accepted as a caller-supplied correlation id. Anything else is
#: replaced: the value is echoed into logs and response headers, so it must not carry newlines.
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _resolve_request_id(raw: str | None) -> str:
    if raw is not None and _REQUEST_ID_PATTERN.match(raw):
        return raw
    return uuid.uuid4().hex[:12]


def _apply_security_headers(response: Response) -> None:
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    if not settings.is_dev:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # noqa: ANN001
        request_id = _resolve_request_id(request.headers.get("X-Request-ID"))
        request.state.request_id = request_id

        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000

        response.headers["X-Request-ID"] = request_id
        _apply_security_headers(response)
        logger.info(
            "%s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            extra={"request_id": request_id},
        )
        return response
