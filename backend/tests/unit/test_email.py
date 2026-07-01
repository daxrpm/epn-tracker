"""SMTP delivery tests without making network connections."""

from app.core import email as email_module


class FakeSMTP:
    instance = None

    def __init__(self, host, port, **kwargs):
        self.host = host
        self.port = port
        self.kwargs = kwargs
        self.ehlo_calls = 0
        self.started_tls = False
        self.credentials = None
        self.message = None
        type(self).instance = self

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def ehlo(self):
        self.ehlo_calls += 1

    def starttls(self, *, context):
        assert context is not None
        self.started_tls = True

    def login(self, username, password):
        self.credentials = (username, password)

    def send_message(self, message):
        self.message = message


def test_smtp_sender_uses_starttls_and_authentication(monkeypatch):
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_module.settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(email_module.settings, "smtp_port", 587)
    monkeypatch.setattr(email_module.settings, "smtp_from_email", "no-reply@example.com")
    monkeypatch.setattr(email_module.settings, "smtp_username", "user")
    monkeypatch.setattr(email_module.settings, "smtp_password", "secret")
    monkeypatch.setattr(email_module.settings, "smtp_starttls", True)
    monkeypatch.setattr(email_module.settings, "smtp_use_ssl", False)

    email_module.SMTPEmailSender._send(
        "student@epn.edu.ec", "Código", "Tu código es 123456."
    )

    smtp = FakeSMTP.instance
    assert smtp.host == "smtp.example.com"
    assert smtp.port == 587
    assert smtp.started_tls is True
    assert smtp.ehlo_calls == 2
    assert smtp.credentials == ("user", "secret")
    assert smtp.message["From"] == "no-reply@example.com"
    assert smtp.message["To"] == "student@epn.edu.ec"
    assert "123456" in smtp.message.get_content()
