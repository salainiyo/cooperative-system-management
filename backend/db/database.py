from dotenv import load_dotenv
import os
from sqlmodel import create_engine, Session
from core.app_logging import logger

load_dotenv()
database_url = os.getenv("DATABASE_URL")
if not database_url:
    logger.critical("Database not loaded. Check enironment variable")
    raise ValueError("Check the environment variable")

# SQLite needs a single shared connection across FastAPI's worker threads;
# PostgreSQL (and other servers) use the normal pool instead.
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)

def get_session():
    with Session(engine) as session:
        yield session