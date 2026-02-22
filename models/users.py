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
    created_at: datetime
    updated_at: datetime


class TokenBlocklist(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    token: str = Field(index=True)
    token_type: str
    blocked_at: datetime = Field(default_factory=utc_now)


class LogoutRequest(SQLModel):
    token: str


class TokenResponse(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
