from datetime import datetime, timezone
from core.app_logging import logger

def utc_now():
    """Returns the current date time in utc """
    return datetime.now(timezone.utc)

def check_none_env_variable(env_variable):
    """Checks whether the environment variable is none and it raise runtime error if it is none"""
    if env_variable:
        return env_variable
    
    logger.critical("Check missing env variable")
    raise RuntimeError("Check missing env variable")