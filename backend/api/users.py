import hashlib
import os
import secrets
from datetime import timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

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
from dependancies.auth import (
    ALGORITHM,
    EXPIRATION_TIME_DAYS,
    SECRET_KEY,
    create_access_token,
    create_password_hash,
    create_refresh_token,
    current_user,
    verify_password_hash,
)
from dependancies.dependancies import utc_now
from models.users import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LogoutRequest,
    PasswordResetToken,
    ResetPasswordRequest,
    TokenBlocklist,
    TokenResponse,
    User,
    UserAdminCreate,
    UserCreate,
    UserRead,
)

user_router = APIRouter(prefix="/auth")
oauth2_scheme = OAuth2PasswordBearer("/auth/login")

RESET_TOKEN_TTL_MINUTES = 30
MIN_PASSWORD_LENGTH = 8
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.",
        )


@user_router.get("/")
@limiter.limit("5/minute")
def home(request: Request):
    return {"status": "active"}


@user_router.post("/setup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minutes")
async def initial_admin_setup(
    request: Request, user_data: UserCreate, session: Session = Depends(get_session)
):
    """Bootstrap: creates the very first (admin) account. Only works while the user table is empty."""
    user_count = session.exec(select(func.count(User.id))).one() or 0
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Setup already completed. Ask an administrator to create your account.",
        )

    _validate_password_strength(user_data.password)
    hash_password = create_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hash_password,
        is_active=True,
        is_admin=True,
    )

    try:
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        logger.info(f"Initial admin account created via setup: {new_user.email}")
        return new_user
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integrity error: possibly a duplicate email.",
        )
    except Exception:
        session.rollback()
        logger.error("Initial admin setup failed unexpectedly.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@user_router.post(
    "/register", response_model=UserRead, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minutes")
async def user_registration(
    request: Request,
    user_data: UserAdminCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    existing_user = session.exec(
        select(User).where(User.email == user_data.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )
    _validate_password_strength(user_data.password)
    hash_password = create_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hash_password,
        is_admin=user_data.is_admin,
        is_active=True,
    )

    try:
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        logger.info(f"Admin {admin.email} registered user: {new_user.email}")
        return new_user

    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integrity error: possibly a duplicate email.",
        )
    except Exception:
        session.rollback()
        logger.error("Registration failed unexpectedly.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@user_router.post("/login")
@limiter.limit("3/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    logger.info(f"Login attempt initiated for user: {form_data.username}")

    statement = select(User).where(User.email == form_data.username)
    db_user = session.exec(statement).first()

    if not db_user:
        logger.warning(f"Login failed: User {form_data.username} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password_hash(form_data.password, db_user.hashed_password):
        logger.warning(
            f"Login failed: Incorrect password for user {form_data.username}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not db_user.is_active:
        logger.warning(f"Login blocked: account disabled for {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Contact the administrator.",
        )

    logger.info(f"Successful login for user ID: {db_user.id}")

    access_token = create_access_token(db_user.id)  # type: ignore
    refresh_token = create_refresh_token(db_user.id)  # type: ignore

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@user_router.get("/me", response_model=UserRead)
@limiter.limit("60/minute")
def get_me(
    request: Request,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    """Returns the authenticated user's info (incl. linked member profile, if any)."""
    from models.models import Member

    member_id = None
    if not user.is_admin:
        member = session.exec(select(Member.id).where(Member.user_id == user.id)).first()
        member_id = member if isinstance(member, int) else (member[0] if member else None)
    return UserRead.model_validate(user, update={"member_id": member_id})


@user_router.post("/logout")
@limiter.limit("10/minute")
async def logout(
    request: Request,
    token_data: LogoutRequest,
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
):
    access_block = TokenBlocklist(token=token, token_type="access")
    refresh_block = TokenBlocklist(token=token_data.token, token_type="refresh")
    try:
        session.add(access_block)
        session.add(refresh_block)
        session.commit()

        logger.info("User logged out and tokens invalidated.")
        return {"message": "Successfully logged out"}

    except IntegrityError:
        session.rollback()
        return {"message": "User already logged out"}

    except Exception:
        session.rollback()
        logger.error("Logout failed unexpectedly.")
        raise HTTPException(status_code=500, detail="Could not log out")


@user_router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh_access_token(
    request: Request, token_data: LogoutRequest, session: Session = Depends(get_session)
):
    auth_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    is_blocked = session.exec(
        select(TokenBlocklist).where(TokenBlocklist.token == token_data.token)
    ).first()
    if is_blocked:
        logger.warning(
            f"Refresh attempt with blacklisted token: {token_data.token[:10]}..."
        )
        raise auth_exception

    try:
        payload = jwt.decode(token_data.token, key=SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if user_id is None or token_type != "refresh":
            raise auth_exception

    except InvalidTokenError:
        raise auth_exception

    user = session.get(User, int(user_id))
    if not user or not user.is_active:
        raise auth_exception

    old_refresh_block = TokenBlocklist(token=token_data.token, token_type="refresh")
    session.add(old_refresh_block)

    # Housekeeping: prune blocklist rows that can no longer match a live token.
    cutoff = utc_now() - timedelta(days=EXPIRATION_TIME_DAYS + 1)
    session.execute(delete(TokenBlocklist).where(TokenBlocklist.blocked_at < cutoff))

    new_access_token = create_access_token(int(user_id))
    new_refresh_token = create_refresh_token(int(user_id))

    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to rotate tokens: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


# ==========================================
# PASSWORD CHANGE & RESET
# ==========================================
@user_router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request, payload: ForgotPasswordRequest, session: Session = Depends(get_session)
):
    """Starts the reset flow. Always returns the same generic message (no user enumeration)."""
    generic_response = {
        "message": "If an account exists for that email, a reset link has been sent."
    }

    smtp_settings = get_active_smtp_settings()
    if not smtp_settings or not smtp_settings.smtp_email or not smtp_settings.smtp_password_encrypted:
        logger.warning("Password reset requested but SMTP is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email is not configured. Ask the administrator to set it up in Settings.",
        )

    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not user.is_active:
        logger.info(f"Password reset requested for unknown/inactive email: {payload.email}")
        return generic_response

    raw_token = secrets.token_urlsafe(32)
    reset_row = PasswordResetToken(
        user_id=user.id,  # type: ignore
        token_hash=_hash_reset_token(raw_token),
        expires_at=utc_now() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
    )
    session.add(reset_row)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to store reset token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    reset_url = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    try:
        send_email(
            user.email,
            "Reset your cooperative account password",
            render_simple_email(
                "Password reset requested",
                [
                    f"Hello {user.email},",
                    "We received a request to reset your password. "
                    f"This link expires in {RESET_TOKEN_TTL_MINUTES} minutes.",
                    "If you did not request this, you can safely ignore this email.",
                ],
                action_url=reset_url,
                action_label="Reset password",
            ),
        )
    except (EmailNotConfiguredError, EmailSendError) as e:
        logger.error(f"Could not deliver reset email to {user.email}: {e}")
        # Do not leak delivery details; the token stays valid if they retry.
        raise HTTPException(status_code=502, detail="Could not send the reset email. Try again later.")

    logger.info(f"Password reset email sent to {user.email}")
    return generic_response


@user_router.post("/reset-password")
@limiter.limit("3/minute")
async def reset_password(
    request: Request, payload: ResetPasswordRequest, session: Session = Depends(get_session)
):
    token_hash = _hash_reset_token(payload.token)
    reset_row = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    ).first()

    now = utc_now()
    expires_at = reset_row.expires_at if reset_row else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=now.tzinfo)

    if not reset_row or reset_row.used_at or (expires_at and expires_at < now):
        logger.warning("Invalid, expired, or already-used reset token presented.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    _validate_password_strength(payload.new_password)
    user = session.get(User, reset_row.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = create_password_hash(payload.new_password)
    # Truncate to whole seconds so tokens issued in the same second stay valid.
    user.password_changed_at = now.replace(microsecond=0)
    reset_row.used_at = now
    session.add(user)
    session.add(reset_row)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Password reset failed for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    logger.info(f"Password reset completed for user {user.email}")
    return {"message": "Password updated. You can now log in."}


@user_router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    session: Session = Depends(get_session),
    user: User = Depends(current_user),
):
    if not verify_password_hash(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    _validate_password_strength(payload.new_password)
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new password must be different from the current one.",
        )

    now = utc_now()
    user.hashed_password = create_password_hash(payload.new_password)
    user.password_changed_at = now.replace(microsecond=0)
    session.add(user)
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Password change failed for {user.email}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    # Old tokens are rejected by the iat check; issue a fresh pair so the user stays logged in.
    logger.info(f"Password changed for {user.email}; issuing fresh tokens.")
    return {
        "access_token": create_access_token(user.id),  # type: ignore
        "refresh_token": create_refresh_token(user.id),  # type: ignore
        "token_type": "bearer",
        "message": "Password changed successfully.",
    }
