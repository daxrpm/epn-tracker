"""Application settings loaded from environment variables / .env."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import EmailStr, Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # App
    app_env: str = "dev"
    app_name: str = "EPN Notas Mallas"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "epn"
    postgres_password: str = "epn"
    postgres_db: str = "epn"

    # Connection pool
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800
    db_echo: bool = False

    # Full URL override (used by the SQLite-based tests).
    database_url_override: str | None = None

    # CORS — comma-separated list of allowed frontend origins.
    backend_cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # JWT — the dev default is long enough for HS256; production must override it.
    jwt_secret: str = "dev-insecure-secret-change-me-please-32bytes+"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # EPN registration
    allowed_email_domain: str = "epn.edu.ec"
    email_code_ttl_seconds: int = 600
    email_code_max_attempts: int = 5
    email_code_resend_seconds: int = 60
    email_codes_per_hour: int = 5

    # Login throttling (ERS §25.2)
    login_max_attempts: int = 10
    login_window_seconds: int = 900

    # Email. Console is intentionally restricted to local development.
    email_backend: Literal["console", "smtp"] = "console"
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: EmailStr | None = None
    smtp_starttls: bool = True
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: float = Field(default=10.0, gt=0, le=120)

    # First super admin bootstrap (used by `python -m seeds.create_admin`).
    first_superadmin_email: str | None = None
    first_superadmin_password: str | None = None

    # Object storage (MinIO/S3) for study resources.
    # ``s3_endpoint_url`` is the in-network endpoint the backend uses; ``s3_public_endpoint_url``
    # is the browser-reachable host used to *sign* GET URLs (must match what the browser hits, or
    # the SigV4 signature fails). They differ under Docker (minio:9000 vs localhost:9000).
    s3_endpoint_url: str = "http://localhost:9000"
    s3_public_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "epnminio"
    s3_secret_key: str = "epnminio123"
    s3_bucket: str = "epn-resources"
    s3_region: str = "us-east-1"
    resource_max_upload_mb: int = 50
    resource_extract_sync_mb: int = 2

    @field_validator(
        "database_url_override",
        "smtp_host",
        "smtp_username",
        "smtp_password",
        "smtp_from_email",
        "first_superadmin_email",
        "first_superadmin_password",
        mode="before",
    )
    @classmethod
    def _empty_optional_values_are_none(cls, value: object) -> object:
        """Compose represents unset optional variables as empty strings."""
        return None if value == "" else value

    @model_validator(mode="after")
    def _check_production_secret(self) -> Settings:
        if self.app_env != "dev" and (
            len(self.jwt_secret) < _MIN_SECRET_LENGTH or self.jwt_secret.startswith("dev-insecure")
        ):
            raise ValueError(
                "JWT_SECRET must be a strong secret of at least "
                f"{_MIN_SECRET_LENGTH} characters outside of development."
            )
        if self.app_env != "dev" and self.email_backend != "smtp":
            raise ValueError("EMAIL_BACKEND must be 'smtp' outside of development.")
        if self.app_env != "dev" and self.debug:
            raise ValueError("DEBUG must be false outside of development.")
        if self.app_env != "dev" and self.postgres_password == "epn":
            raise ValueError("POSTGRES_PASSWORD must not use the development default.")
        if self.app_env != "dev" and self.first_superadmin_password == "ChangeMe-12345":
            raise ValueError("FIRST_SUPERADMIN_PASSWORD must not use the development default.")
        if self.email_backend == "smtp":
            if not self.smtp_host or not self.smtp_from_email:
                raise ValueError(
                    "SMTP_HOST and SMTP_FROM_EMAIL are required when EMAIL_BACKEND=smtp."
                )
            if bool(self.smtp_username) != bool(self.smtp_password):
                raise ValueError("SMTP_USERNAME and SMTP_PASSWORD must be configured together.")
            if self.smtp_starttls and self.smtp_use_ssl:
                raise ValueError("SMTP_STARTTLS and SMTP_USE_SSL cannot both be enabled.")
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
