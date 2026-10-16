# tests/test_settings.py
from decimal import Decimal

from core import settings_cache
from core.crypto import decrypt_secret
from models.settings import SystemSettings
from models.users import User

VALID_APP_PASSWORD = "abcdabcd23452345"


def _make_non_admin_token(session):
    from dependancies.auth import create_access_token

    user = User(
        email="staff@coop.rw",
        hashed_password="x",
        is_active=True,
        is_admin=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return create_access_token(user_id=user.id)


def test_settings_requires_authentication(client):
    assert client.get("/admin/settings/").status_code == 401


def test_settings_requires_admin(client, session):
    token = _make_non_admin_token(session)
    res = client.get("/admin/settings/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_default_settings_shape(client, auth_headers):
    res = client.get("/admin/settings/", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["has_smtp_config"] is False
    assert body["smtp_password_masked"] is None
    assert Decimal(str(body["interest_rate"])) == Decimal("0.015")
    assert Decimal(str(body["late_fee_rate"])) == Decimal("0.03")
    assert Decimal(str(body["loan_savings_multiplier"])) == Decimal("2.00")
    assert "smtp_password" not in body


def test_update_business_rates(client, auth_headers):
    res = client.patch(
        "/admin/settings/",
        json={
            "interest_rate": "0.02",
            "late_fee_rate": "0.05",
            "loan_savings_multiplier": "3.00",
            "org_name": "Kigali Savings Coop",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert Decimal(str(body["interest_rate"])) == Decimal("0.02")
    assert body["org_name"] == "Kigali Savings Coop"

    # The process-wide cache the Loan properties read from must be refreshed.
    assert settings_cache.get_interest_rate() == Decimal("0.02")
    assert settings_cache.get_loan_savings_multiplier() == Decimal("3.00")


def test_smtp_password_is_encrypted_and_masked(client, auth_headers, session):
    res = client.patch(
        "/admin/settings/",
        json={"smtp_email": "coop@gmail.com", "smtp_password": VALID_APP_PASSWORD},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["has_smtp_config"] is True
    assert body["smtp_password_masked"] == "••••••••"
    assert VALID_APP_PASSWORD not in str(body)

    row = session.query(SystemSettings).first()
    assert row.smtp_password_encrypted != VALID_APP_PASSWORD
    assert decrypt_secret(row.smtp_password_encrypted) == VALID_APP_PASSWORD


def test_invalid_app_password_rejected(client, auth_headers, session):
    res = client.patch(
        "/admin/settings/",
        json={"smtp_email": "coop@gmail.com", "smtp_password": "too-short"},
        headers=auth_headers,
    )
    assert res.status_code == 422

    # 16 chars but wrong alphabet (0/1/8/9 are not valid base32 app-password chars)
    bad_alphabet = client.patch(
        "/admin/settings/",
        json={"smtp_email": "coop@gmail.com", "smtp_password": "0000111188889999"},
        headers=auth_headers,
    )
    assert bad_alphabet.status_code == 422

    # The row exists (created lazily) but must never hold the rejected secret.
    row = session.query(SystemSettings).first()
    assert row is None or row.smtp_password_encrypted is None


def test_app_password_requires_sender_email(client, auth_headers):
    res = client.patch(
        "/admin/settings/",
        json={"smtp_password": VALID_APP_PASSWORD},
        headers=auth_headers,
    )
    assert res.status_code == 422


def test_invalid_sender_email_rejected(client, auth_headers):
    res = client.patch(
        "/admin/settings/",
        json={"smtp_email": "not-an-email", "smtp_password": VALID_APP_PASSWORD},
        headers=auth_headers,
    )
    assert res.status_code == 422


def test_test_email_without_smtp_is_503(client, auth_headers):
    res = client.post("/admin/settings/test-email", json={}, headers=auth_headers)
    assert res.status_code == 503


def test_test_email_sends(client, auth_headers, outbox):
    # Configure SMTP through the real API first (the endpoint reads the row).
    configured = client.patch(
        "/admin/settings/",
        json={"smtp_email": "coop@gmail.com", "smtp_password": VALID_APP_PASSWORD},
        headers=auth_headers,
    )
    assert configured.status_code == 200

    res = client.post(
        "/admin/settings/test-email", json={"email": "admin@coop.rw"}, headers=auth_headers
    )
    assert res.status_code == 200
    assert outbox and outbox[0]["to"] == "admin@coop.rw"
    assert "Test email" in outbox[0]["subject"]
