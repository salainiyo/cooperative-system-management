"""Symmetric encryption helpers for secrets at rest (SMTP app password)."""

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

from core.app_logging import logger
from dependancies.auth import SECRET_KEY


def _fernet() -> Fernet:
    # Derive a stable 32-byte key from the app secret; no extra env var needed.
    digest = hashlib.sha256(SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str | None:
    """Returns None (and logs) if the ciphertext cannot be decrypted — e.g. SECRET_KEY rotated."""
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        logger.error(
            "Failed to decrypt a stored secret. The SECRET_KEY may have been rotated; "
            "re-enter the SMTP app password in Settings."
        )
        return None


def mask_secret(plain_or_none: str | None) -> str | None:
    """Shows only the last 4 characters, e.g. '••••abcd'."""
    if not plain_or_none:
        return None
    if len(plain_or_none) <= 4:
        return "••••"
    return f"••••{plain_or_none[-4:]}"
