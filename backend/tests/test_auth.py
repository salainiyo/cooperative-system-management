# tests/test_auth.py
from datetime import timedelta

import jwt as pyjwt

from dependancies.auth import ALGORITHM, SECRET_KEY
from dependancies.dependancies import utc_now
from models.users import User


def _register(client, headers, email="staff@coop.rw", password="password123"):
    res = client.post(
        "/auth/register",
        json={"email": email, "password": password, "is_admin": False},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _login(client, email, password):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_setup_creates_first_admin_and_blocks_second(client):
    res = client.post(
        "/auth/setup", json={"email": "root@coop.rw", "password": "supersecret1"}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["is_admin"] is True
    assert body["email"] == "root@coop.rw"
    assert "password" not in body and "hashed_password" not in body

    second = client.post(
        "/auth/setup", json={"email": "other@coop.rw", "password": "supersecret2"}
    )
    assert second.status_code == 409


def test_setup_rejects_weak_password(client):
    res = client.post("/auth/setup", json={"email": "root@coop.rw", "password": "short"})
    assert res.status_code == 422


def test_register_requires_admin(client, auth_headers):
    anonymous = client.post(
        "/auth/register", json={"email": "x@y.rw", "password": "password123"}
    )
    assert anonymous.status_code == 401

    created = _register(client, auth_headers)
    member_login = _login(client, created["email"], "password123").json()
    forbidden = client.post(
        "/auth/register",
        json={"email": "x@y.rw", "password": "password123"},
        headers={"Authorization": f"Bearer {member_login['access_token']}"},
    )
    assert forbidden.status_code == 403


def test_register_by_admin_and_duplicates(client, auth_headers):
    created = _register(client, auth_headers)
    assert created["email"] == "staff@coop.rw"
    assert created["is_admin"] is False

    duplicate = client.post(
        "/auth/register",
        json={"email": "staff@coop.rw", "password": "password123"},
        headers=auth_headers,
    )
    assert duplicate.status_code == 400

    weak = client.post(
        "/auth/register",
        json={"email": "weak@coop.rw", "password": "short"},
        headers=auth_headers,
    )
    assert weak.status_code == 422


def test_login_success_wrong_password_and_unknown_user(client, auth_headers):
    _register(client, auth_headers)

    ok = _login(client, "staff@coop.rw", "password123")
    assert ok.status_code == 200
    tokens = ok.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    bad = _login(client, "staff@coop.rw", "wrong-password")
    assert bad.status_code == 401

    unknown = _login(client, "ghost@coop.rw", "password123")
    assert unknown.status_code == 401


def test_login_blocked_for_inactive_user(client, auth_headers, session):
    _register(client, auth_headers)

    user = session.query(User).filter(User.email == "staff@coop.rw").one()
    user.is_active = False
    session.add(user)
    session.commit()

    res = _login(client, "staff@coop.rw", "password123")
    assert res.status_code == 403


def test_auth_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401


def test_refresh_rotates_tokens_and_rejects_reuse(client, auth_headers):
    _register(client, auth_headers)
    tokens = _login(client, "staff@coop.rw", "password123").json()

    first_refresh = client.post("/auth/refresh", json={"token": tokens["refresh_token"]})
    assert first_refresh.status_code == 200
    rotated = first_refresh.json()
    assert rotated["refresh_token"] != tokens["refresh_token"]

    # Refresh tokens are single-use.
    reuse = client.post("/auth/refresh", json={"token": tokens["refresh_token"]})
    assert reuse.status_code == 401

    # Access tokens are still valid after refresh.
    me = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {rotated['access_token']}"},
    )
    assert me.status_code == 200


def test_tokens_stale_after_password_change(client, auth_headers, session):
    created = _register(client, auth_headers)
    user_id = created["id"]

    now = utc_now()
    stale = pyjwt.encode(
        {
            "sub": str(user_id),
            "type": "access",
            "iat": now - timedelta(minutes=5),
            "exp": now + timedelta(minutes=10),
        },
        key=SECRET_KEY,
        algorithm=ALGORITHM,
    )

    user = session.get(User, user_id)
    user.password_changed_at = now.replace(microsecond=0)
    session.add(user)
    session.commit()

    stale_res = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {stale}"}
    )
    assert stale_res.status_code == 401

    fresh = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {client.post('/auth/login', data={'username': 'staff@coop.rw', 'password': 'password123'}).json()['access_token']}"},
    )
    assert fresh.status_code == 200


def test_change_password_flow(client, auth_headers):
    _register(client, auth_headers)
    tokens = _login(client, "staff@coop.rw", "password123").json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    wrong_current = client.post(
        "/auth/change-password",
        json={"current_password": "not-the-one", "new_password": "brandnew123"},
        headers=headers,
    )
    assert wrong_current.status_code == 400

    same = client.post(
        "/auth/change-password",
        json={"current_password": "password123", "new_password": "password123"},
        headers=headers,
    )
    assert same.status_code == 400

    short = client.post(
        "/auth/change-password",
        json={"current_password": "password123", "new_password": "short"},
        headers=headers,
    )
    assert short.status_code == 422

    ok = client.post(
        "/auth/change-password",
        json={"current_password": "password123", "new_password": "brandnew123"},
        headers=headers,
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    assert _login(client, "staff@coop.rw", "brandnew123").status_code == 200
    assert _login(client, "staff@coop.rw", "password123").status_code == 401


def test_logout_blocks_access_token(client, auth_headers):
    _register(client, auth_headers)
    tokens = _login(client, "staff@coop.rw", "password123").json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    assert client.get("/auth/me", headers=headers).status_code == 200

    out = client.post("/auth/logout", json={"token": tokens["refresh_token"]}, headers=headers)
    assert out.status_code == 200

    assert client.get("/auth/me", headers=headers).status_code == 401
