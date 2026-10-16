import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.admin_settings import settings_router
from api.loan_requests import loan_requests_admin_router
from api.member_accounts import member_accounts_router, users_admin_router
from api.portal import portal_router
from api.reports import reports_router
from api.services import admin_router, loan_router, member_router, payment_router, savings_router
from api.users import user_router
from core.rate_limiting import limiter

DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:3000"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

app = FastAPI(title="Ikimina management system")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(settings_router)
app.include_router(portal_router)
app.include_router(member_accounts_router)
app.include_router(users_admin_router)
app.include_router(loan_requests_admin_router)
app.include_router(reports_router)
app.include_router(member_router)
app.include_router(loan_router)
app.include_router(payment_router)
app.include_router(admin_router)
app.include_router(savings_router)
