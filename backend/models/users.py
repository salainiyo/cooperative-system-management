from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel, func

from dependancies.dependancies import utc_now


class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)


class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    password_changed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column_kwargs={
            "server_default": func.now(),
        },
    )

    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column_kwargs={
            "server_default": func.now(),
            "onupdate": func.now(),
        },
    )


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    is_active: bool
    is_admin: bool = False
    member_id: int | None = None
    created_at: datetime
    updated_at: datetime


class UserAdminCreate(UserCreate):
    """Admin-only payload for creating a staff account."""
    is_admin: bool = False


class TokenBlocklist(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    token: str = Field(index=True)
    token_type: str
    blocked_at: datetime = Field(default_factory=utc_now)


class PasswordResetToken(SQLModel, table=True):
    """Single-use, time-limited reset token. Only the SHA-256 hash is stored."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(index=True)
    expires_at: datetime
    used_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utc_now)


class LogoutRequest(SQLModel):
    token: str


class TokenResponse(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(SQLModel):
    email: str


class ResetPasswordRequest(SQLModel):
    token: str
    new_password: str


class ChangePasswordRequest(SQLModel):
    current_password: str
    new_password: str


class MemberAccountCreate(SQLModel):
    member_id: int
    email: str
    temp_password: str | None = None
