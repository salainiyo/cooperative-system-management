# conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from db.database import get_session
from dependancies.auth import create_access_token
from main import app
from models.users import User

# 1. Create an in-memory SQLite database (it vanishes when tests end)
TEST_DATABASE_URL = "sqlite://"
engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)


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
