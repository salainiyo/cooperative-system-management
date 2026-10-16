# conftest.py
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from core import settings_cache
from db.database import get_session
from dependancies.auth import create_access_token
from main import app
from models.settings import SystemSettings
from models.users import User

# 1. Test database: in-memory SQLite by default; set TEST_DATABASE_URL to
#    e.g. postgresql+psycopg2://user:pw@localhost:5432/test to exercise Postgres.
import os

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite://")
if TEST_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(TEST_DATABASE_URL)

SMTP_MODULES = (
    "api.users",
    "api.admin_settings",
    "api.member_accounts",
    "api.loan_requests",
)
# Modules holding a reference to the SMTP-settings lookup (some do not import it).
SMTP_LOOKUP_MODULES = ("core.email_service",) + SMTP_MODULES


# 2. Fixture to create tables and provide a session
@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)  # Create tables
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)  # Clean up


# 3. Fixture to override the dependency in FastAPI
@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override

    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False

    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


# 4. Fixture to create an Admin User and get a Token
@pytest.fixture(name="admin_token")
def admin_token_fixture(session: Session):
    # Create a fake admin
    admin = User(
        email="admin@test.com",
        hashed_password="hashed_secret",
        is_active=True,
        is_admin=True,
    )
    session.add(admin)
    session.commit()
    session.refresh(admin)

    return create_access_token(user_id=admin.id)  # type:ignore


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(autouse=True)
def reset_settings_cache():
    """Business rules are process-wide; keep every test on a clean slate."""
    settings_cache.invalidate()
    yield
    settings_cache.invalidate()


@pytest.fixture(autouse=True)
def smtp_settings_lookup(session, monkeypatch):
    """Route the SMTP-settings lookup through the test session (the real engine
    has no tables), while letting tests inject a configured fake."""
    holder = {"settings": None}

    def lookup():
        if holder["settings"] is not None:
            return holder["settings"]
        return session.query(SystemSettings).first()

    for module in SMTP_LOOKUP_MODULES:
        monkeypatch.setattr(f"{module}.get_active_smtp_settings", lookup, raising=False)
    return holder


@pytest.fixture(name="member_id")
def member_id_fixture(client, auth_headers):
    res = client.post(
        "/member/",
        json={
            "first_name": "Test",
            "last_name": "Member",
            "date_of_birth": "1995-04-12",
            "gender": "Female",
            "phone_number": "0789000001",
        },
        headers=auth_headers,
    )
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


@pytest.fixture(name="outbox")
def outbox_fixture(monkeypatch):
    """Captures every outbound email instead of hitting Gmail."""
    outbox = []

    def capture(to, subject, html_body):
        outbox.append({"to": to, "subject": subject, "html": html_body})

    for module in SMTP_MODULES:
        monkeypatch.setattr(f"{module}.send_email", capture)
    return outbox


@pytest.fixture(name="smtp_configured")
def smtp_configured_fixture(smtp_settings_lookup, outbox):  # noqa: F811
    settings = SimpleNamespace(
        smtp_email="coop@example.com",
        smtp_password_encrypted="gAAAAA-test-encrypted",
        org_name="Ikimina Test Coop",
        smtp_host="smtp.gmail.com",
        smtp_port=587,
    )
    smtp_settings_lookup["settings"] = settings
    return settings
