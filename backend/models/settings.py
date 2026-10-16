from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel

from dependancies.dependancies import utc_now


class SystemSettings(SQLModel, table=True):
    """Single-row table holding cooperative business rules + SMTP configuration."""

    id: Optional[int] = Field(default=None, primary_key=True)
    org_name: str = Field(default="Ikimina Cooperative", max_length=120)

    # SMTP (Gmail app-password). Password is stored Fernet-encrypted, never in plain text.
    smtp_email: Optional[str] = Field(default=None, max_length=254)
    smtp_password_encrypted: Optional[str] = Field(default=None, max_length=512)
    smtp_host: str = Field(default="smtp.gmail.com", max_length=254)
    smtp_port: int = Field(default=587)

    # Business rules (rates kept as decimals: 0.015 == 1.5%)
    interest_rate: Decimal = Field(default=Decimal("0.015"), max_digits=6, decimal_places=4)
    late_fee_rate: Decimal = Field(default=Decimal("0.03"), max_digits=6, decimal_places=4)
    loan_savings_multiplier: Decimal = Field(
        default=Decimal("2.00"), max_digits=6, decimal_places=2
    )

    updated_at: datetime = Field(
        default_factory=utc_now, sa_column_kwargs={"onupdate": utc_now}
    )


class SettingsRead(SQLModel):
    """Safe view of settings — the app password is never returned."""

    org_name: str
    has_smtp_config: bool
    smtp_email: Optional[str] = None
    smtp_host: str
    smtp_port: int
    smtp_password_masked: Optional[str] = None
    interest_rate: Decimal
    late_fee_rate: Decimal
    loan_savings_multiplier: Decimal


class SettingsUpdate(SQLModel):
    org_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    smtp_email: Optional[str] = Field(default=None, max_length=254)
    smtp_password: Optional[str] = Field(default=None, min_length=1, max_length=64)
    smtp_host: Optional[str] = Field(default=None, min_length=1, max_length=254)
    smtp_port: Optional[int] = Field(default=None, ge=1, le=65535)
    interest_rate: Optional[Decimal] = Field(default=None, gt=0, lt=1)
    late_fee_rate: Optional[Decimal] = Field(default=None, ge=0, lt=1)
    loan_savings_multiplier: Optional[Decimal] = Field(default=None, gt=0, le=100)


class TestEmailRequest(SQLModel):
    """Optional override; defaults to the authenticated admin's own email."""

    email: Optional[str] = Field(default=None, max_length=254)
