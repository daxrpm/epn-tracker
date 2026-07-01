"""Application settings loaded from environment variables / .env."""

from __future__ import annotations

from functools import lru_cache

from pydantic import computed_field, model_validator
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

    # Full URL override (used by the SQLite-based tests).
    database_url_override: str | None = None

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

    # Email
    email_backend: str = "console"

    @model_validator(mode="after")
    def _check_production_secret(self) -> Settings:
        if self.app_env != "dev" and (
            len(self.jwt_secret) < _MIN_SECRET_LENGTH
            or self.jwt_secret.startswith("dev-insecure")
        ):
            raise ValueError(
                "JWT_SECRET must be a strong secret of at least "
                f"{_MIN_SECRET_LENGTH} characters outside of development."
            )
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
    def is_dev(self) -> bool:
        return self.app_env == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
