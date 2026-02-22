from fastapi import Depends, HTTPException, status

from core.app_logging import logger
from dependancies.auth import current_user
from models.users import User


def admin_required(current_user: User = Depends(current_user)):
    """
    Check if the authenticated user has admin privileges.
    """
    if not current_user.is_admin:
        logger.warning(f"Unauthorized admin access attempt by: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have sufficient privileges to perform this action",
        )
    return current_user
