from dotenv import load_dotenv
import os
from sqlmodel import create_engine, Session
from core.app_logging import logger

load_dotenv()
database_url = os.getenv("DATABASE_URL")
if not database_url:
    logger.critical("Database not loaded. Check enironment variable")
    raise ValueError("Check the environment variable")

connect_args={"check_same_thread":False}
engine = create_engine(database_url, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        return session