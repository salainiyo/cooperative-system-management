"""Process-wide cache of business rules from SystemSettings.

The Loan model's computed properties need the configured rates without a DB
session, so rules are loaded lazily (and reloaded whenever settings change).
"""

from decimal import Decimal
from typing import Optional

from core.app_logging import logger
from db.database import get_session
from models.settings import SystemSettings

DEFAULT_INTEREST_RATE = Decimal("0.015")
DEFAULT_LATE_FEE_RATE = Decimal("0.03")
DEFAULT_LOAN_MULTIPLIER = Decimal("2.00")


class BusinessRules:
    def __init__(
        self,
        interest_rate: Decimal = DEFAULT_INTEREST_RATE,
        late_fee_rate: Decimal = DEFAULT_LATE_FEE_RATE,
        loan_savings_multiplier: Decimal = DEFAULT_LOAN_MULTIPLIER,
        org_name: str = "Ikimina Cooperative",
    ):
        self.interest_rate = interest_rate
        self.late_fee_rate = late_fee_rate
        self.loan_savings_multiplier = loan_savings_multiplier
        self.org_name = org_name


_cache: Optional[BusinessRules] = None


def invalidate() -> None:
    global _cache
    _cache = None


def _rules_from_settings(settings: Optional[SystemSettings]) -> BusinessRules:
    if not settings:
        return BusinessRules()
    return BusinessRules(
        interest_rate=settings.interest_rate,
        late_fee_rate=settings.late_fee_rate,
        loan_savings_multiplier=settings.loan_savings_multiplier,
        org_name=settings.org_name,
    )


def reload_from_session(session) -> None:
    """Refresh the cache using the caller's session (keeps tests consistent)."""
    global _cache
    try:
        _cache = _rules_from_settings(session.query(SystemSettings).first())
    except Exception as e:
        logger.warning(f"Could not reload business rules: {e}")
        _cache = BusinessRules()


def _load_from_db() -> BusinessRules:
    session = next(get_session())
    try:
        return _rules_from_settings(session.query(SystemSettings).first())
    finally:
        session.close()


def get_rules() -> BusinessRules:
    global _cache
    if _cache is None:
        try:
            _cache = _load_from_db()
        except Exception as e:
            logger.warning(f"Could not load business rules from DB, using defaults: {e}")
            _cache = BusinessRules()
    return _cache


def get_interest_rate() -> Decimal:
    return get_rules().interest_rate


def get_late_fee_rate() -> Decimal:
    return get_rules().late_fee_rate


def get_loan_savings_multiplier() -> Decimal:
    return get_rules().loan_savings_multiplier
