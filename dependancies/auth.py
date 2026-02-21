import os
from datetime import timedelta

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
oauth2_scheme = OAuth2PasswordBearer("/login")


def create_password_hash(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def verify_password_hash(hashed_password: str, plain_password: str) -> bool:
    return password_hash.verify(hashed_password, plain_password)


def _create_token(data: dict, expire_delta: timedelta, token_type: str):
    to_encode = data.copy()
    expiration = utc_now() + expire_delta
    to_encode.update({"exp": expiration, "type": token_type})
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


def get_current_user(
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

        if user_id is None or token_type != "access":
            raise auth_exception

    except InvalidTokenError as e:
        logger.error(f"JWT Decode error: {str(e)}")
        raise auth_exception

    user = session.get(User, user_id)

    if not user:
        raise auth_exception

    return user
