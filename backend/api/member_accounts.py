import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from core.app_logging import logger
from core.email_service import (
    EmailNotConfiguredError,
    EmailSendError,
    get_active_smtp_settings,
    render_simple_email,
    send_email,
)
from core.rate_limiting import limiter
from db.database import get_session
from dependancies.admin_auth import admin_required
from dependancies.auth import create_password_hash
from models.models import Member
from models.users import MemberAccountCreate, User

member_accounts_router = APIRouter(prefix="/admin/member-accounts", tags=["Admin Member Accounts"])
users_admin_router = APIRouter(prefix="/admin/users", tags=["Admin Users"])

TEMP_PASSWORD_LENGTH = 10


def _generate_temp_password() -> str:
    # Unambiguous alphabet so members can read it over the phone.
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(TEMP_PASSWORD_LENGTH))


def _send_credentials_email(member: Member, email: str, password: str) -> None:
    settings = get_active_smtp_settings()
    if not settings or not settings.smtp_email or not settings.smtp_password_encrypted:
        logger.warning("SMTP not configured; credentials email skipped.")
        return
    try:
        send_email(
            email,
            f"Your {settings.org_name} portal account",
            render_simple_email(
                "Welcome to the member portal",
                [
                    f"Hello {member.first_name} {member.last_name},",
                    f"Your portal account has been created.",
                    f"Email: <strong>{email}</strong>",
                    f"Temporary password: <strong>{password}</strong>",
                    "Sign in and change your password immediately.",
                ],
                action_url="https://ikimina.duckdns.org/login",
                action_label="Go to sign in",
            ),
        )
    except (EmailNotConfiguredError, EmailSendError) as e:
        logger.warning(f"Could not email credentials to {email}: {e}")


@member_accounts_router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_member_account(
    request: Request,
    payload: MemberAccountCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Creates (or re-links) a portal login for a member and emails the credentials."""
    member_id = payload.member_id
    email = payload.email.strip()
    temp_password = payload.temp_password or _generate_temp_password()

    if not member_id or not email or "@" not in email:
        raise HTTPException(
            status_code=422, detail="member_id and a valid email are required."
        )

    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    existing_user_by_email = session.exec(
        select(User).where(User.email == email)
    ).first()
    if existing_user_by_email and existing_user_by_email.id != member.user_id:
        raise HTTPException(
            status_code=400, detail="Another account already uses this email."
        )

    if member.user_id:
        user = session.get(User, member.user_id)
        if user:
            user.email = email
            user.hashed_password = create_password_hash(temp_password)
            user.is_active = True
            session.add(user)
            try:
                session.commit()
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to reset member account: {e}")
                raise HTTPException(status_code=500, detail="Could not update the account.")
            _send_credentials_email(member, email, temp_password)
            logger.info(f"Admin {admin.email} reset credentials for member #{member_id}")
            return {
                "message": "Account credentials reset.",
                "member_id": member_id,
                "email": email,
                "temporary_password": temp_password,
            }

    new_user = User(
        email=email,
        hashed_password=create_password_hash(temp_password),
        is_active=True,
        is_admin=False,
    )
    session.add(new_user)
    session.flush()
    member.user_id = new_user.id
    session.add(member)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to create member account: {e}")
        raise HTTPException(status_code=500, detail="Could not create the account.")

    _send_credentials_email(member, email, temp_password)
    logger.info(f"Admin {admin.email} created portal account for member #{member_id}")
    return {
        "message": "Portal account created.",
        "member_id": member_id,
        "email": email,
        "temporary_password": temp_password,
    }


@member_accounts_router.post("/{member_id}/revoke-password")
@limiter.limit("10/minute")
async def revoke_member_password(
    request: Request,
    member_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    member = session.get(Member, member_id)
    if not member or not member.user_id:
        raise HTTPException(status_code=404, detail="No portal account for this member.")

    user = session.get(User, member.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Linked user account not found.")

    temp_password = _generate_temp_password()
    user.hashed_password = create_password_hash(temp_password)
    # Invalidate all outstanding sessions for the member.
    from dependancies.dependancies import utc_now

    user.password_changed_at = utc_now().replace(microsecond=0)
    session.add(user)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to revoke password for member #{member_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not reset the password.")

    _send_credentials_email(member, user.email, temp_password)
    logger.info(f"Admin {admin.email} revoked password for member #{member_id}")
    return {
        "message": "Password reset. A new temporary password was emailed.",
        "member_id": member_id,
        "email": user.email,
        "temporary_password": temp_password,
    }


@member_accounts_router.delete("/{member_id}")
@limiter.limit("10/minute")
async def delete_member_account(
    request: Request,
    member_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    member = session.get(Member, member_id)
    if not member or not member.user_id:
        raise HTTPException(status_code=404, detail="No portal account for this member.")

    user = session.get(User, member.user_id)
    member.user_id = None
    session.add(member)
    if user:
        session.delete(user)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to delete member account #{member_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not delete the account.")

    logger.warning(f"Admin {admin.email} deleted portal account for member #{member_id}")
    return {"message": "Portal account removed.", "member_id": member_id}


@users_admin_router.get("")
@limiter.limit("20/minute")
async def list_users(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    users = session.exec(select(User)).all()
    member_by_user = {
        m.user_id: m
        for m in session.exec(select(Member).where(Member.user_id.is_not(None))).all()  # type: ignore
    }
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at,
                "member_id": member_by_user[u.id].id if u.id in member_by_user else None,
                "member_name": (
                    f"{member_by_user[u.id].first_name} {member_by_user[u.id].last_name}"
                    if u.id in member_by_user
                    else None
                ),
            }
            for u in users
        ]
    }
