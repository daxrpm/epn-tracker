"""MinIO/S3 object storage for study resources.

Uses ``aioboto3`` to match the async stack. Uploads stream through the backend (after
validation); previews are proxied by the API (same-origin), and the ``download`` button uses a
presigned GET URL signed with the *public* endpoint so the browser can reach it.
"""

from __future__ import annotations

import contextlib
import json
from collections.abc import AsyncIterator
from typing import Any

import aioboto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.conf import settings

_session = aioboto3.Session()


def _client(*, public: bool = False):
    """Return an S3 client context manager.

    ``public=True`` signs URLs against ``s3_public_endpoint_url`` (browser-reachable host) so the
    SigV4 signature matches the request the browser actually makes.
    """
    endpoint = settings.s3_public_endpoint_url if public else settings.s3_endpoint_url
    return _session.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


_CORS_CONFIG = {
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedOrigins": settings.cors_origins or ["*"],
            "ExposeHeaders": ["Content-Length", "Content-Type"],
            "MaxAgeSeconds": 3600,
        }
    ]
}


async def ensure_bucket() -> None:
    """Create the bucket if missing and apply a permissive-read CORS policy. Idempotent."""
    async with _client() as s3:
        try:
            await s3.head_bucket(Bucket=settings.s3_bucket)
        except ClientError:
            with contextlib.suppress(ClientError):
                await s3.create_bucket(Bucket=settings.s3_bucket)
        with contextlib.suppress(ClientError):
            await s3.put_bucket_cors(
                Bucket=settings.s3_bucket, CORSConfiguration=_CORS_CONFIG
            )


async def put_object(key: str, data: bytes, content_type: str) -> None:
    async with _client() as s3:
        await s3.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )


async def delete_object(key: str) -> None:
    async with _client() as s3:
        with contextlib.suppress(ClientError):
            await s3.delete_object(Bucket=settings.s3_bucket, Key=key)


async def presigned_get_url(
    key: str, *, filename: str | None = None, expires: int = 600
) -> str:
    """Presigned GET signed with the public endpoint, forcing an attachment download."""
    params: dict[str, Any] = {"Bucket": settings.s3_bucket, "Key": key}
    if filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
    async with _client(public=True) as s3:
        return await s3.generate_presigned_url(
            "get_object", Params=params, ExpiresIn=expires
        )


async def stream_object(key: str) -> tuple[AsyncIterator[bytes], str]:
    """Yield the object's bytes (for same-origin inline preview) plus its content type."""
    async with _client() as s3:
        obj = await s3.get_object(Bucket=settings.s3_bucket, Key=key)
        content_type = obj.get("ContentType", "application/octet-stream")
        body = await obj["Body"].read()

    async def _iter() -> AsyncIterator[bytes]:
        yield body

    return _iter(), content_type


# Re-exported for callers that want to serialize the CORS policy (e.g. an mc init job).
CORS_POLICY_JSON = json.dumps(_CORS_CONFIG)
