# tests/test_password_reset.py
import re


def _register_and_login(client, headers, email="member@coop.rw"):
    res = client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "is_admin": False},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _extract_token(html: str) -> str:
    match = re.search(r"token=([A-Za-z0-9_\-]+)", html)
    assert match, "Reset email did not contain a reset link"
    return match.group(1)


def test_forgot_password_requires_smtp(client):
    res = client.post("/auth/forgot-password", json={"email": "someone@coop.rw"})
    assert res.status_code == 503


def test_forgot_password_no_user_enumeration(client, auth_headers, outbox, smtp_configured):
    _register_and_login(client, auth_headers)

    unknown = client.post(
        "/auth/forgot-password", json={"email": "nobody@coop.rw"}
    )
    assert unknown.status_code == 200

    known = client.post("/auth/forgot-password", json={"email": "member@coop.rw"})
    assert known.status_code == 200
    assert unknown.json() == known.json(), "Responses must be identical (no leak)"


def test_full_reset_flow(client, auth_headers, smtp_configured, outbox):
    _register_and_login(client, auth_headers)

    # 1. Request the reset link
    res = client.post("/auth/forgot-password", json={"email": "member@coop.rw"})
    assert res.status_code == 200
    assert "if an account exists" in res.json()["message"].lower()
    assert len(outbox) == 1
    assert outbox[0]["to"] == "member@coop.rw"
    token = _extract_token(outbox[0]["html"])

    # 2. Reuse of an unknown token is rejected
    bad = client.post(
        "/auth/reset-password", json={"token": "not-a-real-token", "new_password": "brandnew123"}
    )
    assert bad.status_code == 400

    # 3. Weak password rejected
    weak = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "short"}
    )
    assert weak.status_code == 422

    # 4. Actually reset
    ok = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "brandnew123"}
    )
    assert ok.status_code == 200

    # 5. Token is single-use
    reuse = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "another1234"}
    )
    assert reuse.status_code == 400

    # 6. New credentials work, old ones do not
    assert client.post(
        "/auth/login", data={"username": "member@coop.rw", "password": "brandnew123"}
    ).status_code == 200
    assert client.post(
        "/auth/login", data={"username": "member@coop.rw", "password": "password123"}
    ).status_code == 401


def test_reset_invalidates_existing_sessions(client, auth_headers, smtp_configured, outbox, session):
    from datetime import timedelta

    import jwt as pyjwt

    from dependancies.auth import ALGORITHM, SECRET_KEY
    from dependancies.dependancies import utc_now
    from models.users import User

    created = _register_and_login(client, auth_headers)

    client.post("/auth/forgot-password", json={"email": "member@coop.rw"})
    token = _extract_token(outbox[0]["html"])
    assert client.post(
        "/auth/reset-password", json={"token": token, "new_password": "brandnew123"}
    ).status_code == 200

    user = session.get(User, created["id"])
    changed_at = user.password_changed_at
    assert changed_at is not None

    # A token issued before the password change must be rejected.
    stale = pyjwt.encode(
        {
            "sub": str(created["id"]),
            "type": "access",
            "iat": changed_at - timedelta(minutes=10),
            "exp": utc_now() + timedelta(minutes=10),
        },
        key=SECRET_KEY,
        algorithm=ALGORITHM,
    )
    assert client.get(
        "/auth/me", headers={"Authorization": f"Bearer {stale}"}
    ).status_code == 401
