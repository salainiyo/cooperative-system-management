import os
import jwt
from pwdlib import PasswordHash
from datetime import timedelta
from dotenv import load_dotenv

from dependancies.dependancies import check_none_env_variable
from dependancies.dependancies import utc_now

load_dotenv()
SECRET_KEY = check_none_env_variable(os.getenv("SECRET_KEY"))
ALGORITHM = check_none_env_variable(os.getenv("ALORITHM"))
EXPIRATION_TIME_MINUTES = int(check_none_env_variable(os.getenv("EXPIRATION_TIME_MINUTES")))
EXPIRATION_TIME_DAYS = int(check_none_env_variable(os.getenv("EXPIRATION_TIME_DAYS")))
ALGORITHM = check_none_env_variable(os.getenv(ALGORITHM))

password_hash = PasswordHash.recommended()

def create_password_hash(plain_password: str)-> str:
    return password_hash.hash(plain_password)

def verify_password_hash(hashed_password: str, plain_password: str) -> bool:
    return password_hash.verify(hashed_password, plain_password)

def _create_token(data: dict, expire_delta: timedelta, token_type:str):
    to_encode = data.copy()
    expiration = utc_now() + expire_delta
    to_encode.update({"exp": expiration, "type":token_type})
    return jwt.encode(to_encode, key=SECRET_KEY, algorithm=ALGORITHM)
    
def create_access_token(user_id: int):
    return _create_token(
        data= {"sub": str(user_id)},
        expire_delta = timedelta(minutes=EXPIRATION_TIME_MINUTES),
        token_type="access"
    )

def create_refresh_token(user_id: int):
    return _create_token(
        data={"sub": str(user_id)},
        expire_delta=timedelta(days=EXPIRATION_TIME_DAYS),
        token_type="refresh"
    )