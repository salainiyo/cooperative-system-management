from fastapi import APIRouter, HTTPException, Depends, Request, status
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError

from db.database import get_session
from models.users import User, UserCreate, UserRead
from core.rate_limiting import limiter
from core.app_logging import logger
from dependancies.auth import create_password_hash

user_router = APIRouter()

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