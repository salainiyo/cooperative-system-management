import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from core.app_logging import logger
from core.crypto import encrypt_secret, mask_secret
from core.email_service import EmailNotConfiguredError, EmailSendError, render_simple_email, send_email
from core.rate_limiting import limiter
from core import settings_cache
from db.database import get_session
from dependancies.admin_auth import admin_required
from models.settings import SettingsRead, SettingsUpdate, SystemSettings, TestEmailRequest
from models.users import User

settings_router = APIRouter(prefix="/admin/settings", tags=["Admin Settings"])

GMAIL_APP_PASSWORD_RE = re.compile(r"^[a-zA-Z2-7]{16}$")


def _to_read(settings: SystemSettings) -> SettingsRead:
    has_smtp = bool(settings.smtp_email and settings.smtp_password_encrypted)
    return SettingsRead(
        org_name=settings.org_name,
        has_smtp_config=has_smtp,
        smtp_email=settings.smtp_email,
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_password_masked=("••••••••" if has_smtp else None),
        interest_rate=settings.interest_rate,
        late_fee_rate=settings.late_fee_rate,
        loan_savings_multiplier=settings.loan_savings_multiplier,
    )


def _get_or_create_settings(session: Session) -> SystemSettings:
    settings = session.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@settings_router.get("/", response_model=SettingsRead)
@limiter.limit("20/minute")
async def get_settings(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    return _to_read(_get_or_create_settings(session))


@settings_router.patch("/", response_model=SettingsRead)
@limiter.limit("10/minute")
async def update_settings(
    request: Request,
    settings_update: SettingsUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    settings = _get_or_create_settings(session)
    update_data = settings_update.model_dump(exclude_unset=True)

    if not update_data:
        return _to_read(settings)

    # The plain app password is transformed to ciphertext before hitting the row.
    plain_password = update_data.pop("smtp_password", None)
    if plain_password is not None:
        normalized = plain_password.replace(" ", "")
        if not GMAIL_APP_PASSWORD_RE.match(normalized):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A Gmail App Password is exactly 16 characters (letters and digits 2-7). "
                        "Create one at myaccount.google.com → App passwords.",
            )
        update_data["smtp_password_encrypted"] = encrypt_secret(normalized)
        if "smtp_email" not in update_data and not settings.smtp_email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide the Gmail sender address together with the app password.",
            )

    if "smtp_email" in update_data and update_data["smtp_email"] is not None:
        email = update_data["smtp_email"].strip()
        if "@" not in email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid sender email address.",
            )
        update_data["smtp_email"] = email

    settings.sqlmodel_update(update_data)
    try:
        session.add(settings)
        session.commit()
        session.refresh(settings)
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(status_code=500, detail="Could not save settings.")

    settings_cache.reload_from_session(session)
    logger.info(f"Settings updated by {admin.email}: {list(update_data.keys())}")
    return _to_read(settings)


@settings_router.post("/test-email")
@limiter.limit("3/minute")
async def send_test_email(
    request: Request,
    test_request: TestEmailRequest,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    recipient = (test_request.email or admin.email).strip()
    settings = _get_or_create_settings(session)

    if not settings.smtp_email or not settings.smtp_password_encrypted:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email is not configured. Set the sender address and app password first.",
        )

    try:
        send_email(
            recipient,
            f"Test email from {settings.org_name}",
            render_simple_email(
                "SMTP is working",
                [
                    f"This is a test email from <strong>{settings.org_name}</strong>.",
                    f"It was sent from <strong>{settings.smtp_email}</strong>.",
                    "If you received this, password recovery emails will work.",
                ],
            ),
        )
    except EmailNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except EmailSendError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"message": f"Test email sent to {recipient}"}
