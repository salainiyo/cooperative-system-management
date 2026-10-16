"""SMTP email delivery using the admin-configured Gmail app password."""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from core.app_logging import logger
from core.crypto import decrypt_secret
from db.database import get_session
from models.settings import SystemSettings


class EmailNotConfiguredError(Exception):
    """Raised when SMTP settings are missing or the stored secret cannot be decrypted."""


class EmailSendError(Exception):
    """Raised when the SMTP server rejects the message."""


def get_active_smtp_settings() -> SystemSettings | None:
    session = next(get_session())
    try:
        return session.query(SystemSettings).first()
    finally:
        session.close()


def send_email(to: str, subject: str, html_body: str) -> None:
    """Sends an HTML email through the configured SMTP server.

    Tests monkeypatch this function to capture messages instead of hitting Gmail.
    """
    settings = get_active_smtp_settings()
    if not settings or not settings.smtp_email or not settings.smtp_password_encrypted:
        raise EmailNotConfiguredError("SMTP is not configured. Set it up in Settings.")

    password = decrypt_secret(settings.smtp_password_encrypted)
    if not password:
        raise EmailNotConfiguredError(
            "Stored SMTP password could not be decrypted. Re-enter it in Settings."
        )

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.smtp_email
    message["To"] = to
    message.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            server.starttls()
            server.login(settings.smtp_email, password)
            server.sendmail(settings.smtp_email, [to], message.as_string())
        logger.info(f"Email sent to {to}: {subject}")
    except (smtplib.SMTPException, OSError) as e:
        logger.error(f"SMTP delivery failed for {to}: {e}")
        raise EmailSendError(f"Could not send email: {e}") from e


def render_simple_email(heading: str, body_lines: list[str], action_url: str | None = None, action_label: str = "Open") -> str:
    """Small inline-styles HTML template (no Jinja dependency)."""
    paragraphs = "".join(f"<p style='margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6'>{line}</p>" for line in body_lines)
    button = ""
    if action_url:
        button = (
            f"<p style='margin:24px 0'><a href='{action_url}' style='background:#4f46e5;color:#ffffff;"
            f"text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px'>"
            f"{action_label}</a></p>"
            f"<p style='margin:0;color:#94a3b8;font-size:12px'>Or copy this link: <br>{action_url}</p>"
        )
    return f"""
    <div style='font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px'>
      <h2 style='color:#0f172a;font-size:20px;margin:0 0 16px'>{heading}</h2>
      {paragraphs}
      {button}
      <hr style='border:none;border-top:1px solid #e2e8f0;margin:24px 0'>
      <p style='color:#94a3b8;font-size:12px;margin:0'>Ikimina Cooperative Management System</p>
    </div>
    """
