"""Safety checks for environment configuration and UTC database columns."""

import pytest
from pydantic import ValidationError

from app.core.conf import Settings
from app.modules.iam.model import User


def _production_settings(**overrides) -> dict:
    values = {
        "app_env": "production",
        "debug": False,
        "jwt_secret": "a-production-secret-with-more-than-32-characters",
        "postgres_password": "a-production-database-password",
        "email_backend": "smtp",
        "smtp_host": "smtp.example.com",
        "smtp_from_email": "no-reply@example.com",
    }
    values.update(overrides)
    return values


def test_production_rejects_console_email_backend():
    with pytest.raises(ValidationError, match="EMAIL_BACKEND"):
        Settings(_env_file=None, **_production_settings(email_backend="console"))


def test_production_rejects_development_admin_password():
    with pytest.raises(ValidationError, match="FIRST_SUPERADMIN_PASSWORD"):
        Settings(
            _env_file=None,
            **_production_settings(first_superadmin_password="ChangeMe-12345"),
        )


def test_smtp_requires_complete_credentials():
    with pytest.raises(ValidationError, match="configured together"):
        Settings(
            _env_file=None,
            email_backend="smtp",
            smtp_host="smtp.example.com",
            smtp_from_email="no-reply@example.com",
            smtp_username="user",
        )


def test_empty_optional_smtp_values_are_valid_in_development():
    config = Settings(
        _env_file=None,
        email_backend="console",
        smtp_host="",
        smtp_username="",
        smtp_password="",
        smtp_from_email="",
    )

    assert config.smtp_host is None
    assert config.smtp_from_email is None


def test_database_datetimes_are_timezone_aware():
    assert User.__table__.c.created_at.type.timezone is True
    assert User.__table__.c.updated_at.type.timezone is True
    assert User.__table__.c.email_verified_at.type.timezone is True
