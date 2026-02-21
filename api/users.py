from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from fastapi.security import OAuth2PasswordRequestForm

from db.database import get_session
from models.users import User, UserCreate, UserRead, TokenBlocklist, LogoutRequest
from core.rate_limiting import limiter
from core.app_logging import logger
from dependancies.auth import create_password_hash, verify_password_hash, create_access_token, create_refresh_token

user_router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer("/login")

@user_router.get("/")
@limiter.limit("5/minute")
def home(request: Request):
    return {"status":"active"}

@user_router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minutes")
async def user_registration(
    request: Request,
    user_data: UserCreate, 
    session: Session = Depends(get_session)
):
    existing_user = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    hash_password = create_password_hash(user_data.password)
    new_user = User.model_validate(
        user_data, 
        update={"hashed_password": hash_password}
    )
    
    try:
        session.add(new_user)
        session.commit()
        logger.info(f"User registered successfully: {new_user.email}")
        return new_user
        
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Integrity error: possibly a duplicate email."
        )
    except Exception as e:
        session.rollback()
        logger.error(f"Registration failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
        
@user_router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    logger.info(f"Login attempt initiated for user: {form_data.username}")

    statement = select(User).where(User.email == form_data.username)
    db_user = session.exec(statement).first()

    if not db_user:
        logger.warning(f"Login failed: User {form_data.username} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not verify_password_hash(form_data.password, db_user.hashed_password):
        logger.warning(f"Login failed: Incorrect password for user {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    logger.info(f"Successful login for user ID: {db_user.id}")

    access_token = create_access_token(db_user.id)  # type: ignore
    refresh_token = create_refresh_token(db_user.id)  # type: ignore

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
    
@user_router.post("/logout")
async def logout(token_data: LogoutRequest,
                token: str = Depends(oauth2_scheme),
                session: Session = Depends(get_session)):
    access_block = TokenBlocklist(token=token, token_type="access")
    refresh_block = TokenBlocklist(token=token_data.token, token_type="refresh")
    try:
        session.add(access_block)
        session.add(refresh_block)
        session.commit()
        
        logger.info("User logged out and tokens invalidated.")
        return {"message": "Successfully logged out"}
    
    except IntegrityError:
        session.rollback()
        return {"message": "User already logged out"}
    
    except Exception as e:
        session.rollback()
        logger.error(f"Logout failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not log out")