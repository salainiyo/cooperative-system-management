import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from sqlmodel import Session, select

from core.app_logging import logger
from db.database import get_session
from dependancies.dependancies import check_none_env_variable, utc_now
from models.users import TokenBlocklist, User

load_dotenv()
SECRET_KEY = check_none_env_variable(os.getenv("SECRET_KEY"))
ALGORITHM = check_none_env_variable(os.getenv("ALGORITHM"))
EXPIRATION_TIME_MINUTES = int(
    check_none_env_variable(os.getenv("EXPIRATION_TIME_MINUTES"))
)
EXPIRATION_TIME_DAYS = int(check_none_env_variable(os.getenv("EXPIRATION_TIME_DAYS")))
ALGORITHM = check_none_env_variable(os.getenv("ALGORITHM"))

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer("/auth/login")


def create_password_hash(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def verify_password_hash(hashed_password: str, plain_password: str) -> bool:
    return password_hash.verify(hashed_password, plain_password)


def _create_token(data: dict, expire_delta: timedelta, token_type: str):
    to_encode = data.copy()
    issued_at = utc_now()
    expiration = issued_at + expire_delta
    # jti keeps every minted token unique (makes refresh rotation meaningful).
    to_encode.update(
        {
            "exp": expiration,
            "iat": issued_at,
            "type": token_type,
            "jti": secrets.token_hex(8),
        }
    )
    return jwt.encode(to_encode, key=SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: int):
    return _create_token(
        data={"sub": str(user_id)},
        expire_delta=timedelta(minutes=EXPIRATION_TIME_MINUTES),
        token_type="access",
    )


def create_refresh_token(user_id: int):
    return _create_token(
        data={"sub": str(user_id)},
        expire_delta=timedelta(days=EXPIRATION_TIME_DAYS),
        token_type="refresh",
    )


def current_user(
    token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)
):
    auth_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    is_blacklisted = session.exec(
        select(TokenBlocklist).where(TokenBlocklist.token == token)
    ).first()
    if is_blacklisted:
        logger.warning("Attempted use of blacklisted token.")
        raise auth_exception

    try:
        payload = jwt.decode(token, key=SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        issued_at = payload.get("iat")

        if user_id is None or token_type != "access":
            raise auth_exception

    except InvalidTokenError as e:
        logger.error(f"JWT Decode error: {str(e)}")
        raise auth_exception

    user = session.get(User, int(user_id))

    if not user or not user.is_active:
        raise auth_exception

    # Tokens issued before the last password change are dead.
    if user.password_changed_at and issued_at:
        changed_at = user.password_changed_at
        if changed_at.tzinfo is None:
            changed_at = changed_at.replace(tzinfo=timezone.utc)
        issued_dt = datetime.fromtimestamp(float(issued_at), tz=timezone.utc)
        if issued_dt < changed_at:
            logger.warning(f"Rejected stale token for user {user.email} (issued before password change).")
            raise auth_exception

    return user
