from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.services import admin_router, loan_router, member_router, payment_router
from api.users import user_router
from core.rate_limiting import limiter
from dependancies.scheduler import check_and_send_due_reminders

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        check_and_send_due_reminders,
        trigger="interval",
        minutes=1,
        # trigger="cron",
        # hour=8,
        # minutes=0,
        # id="daily_due_remainder",
    )
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan, title="Ikimina management system")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

app.include_router(user_router)
app.include_router(member_router)
app.include_router(loan_router)
app.include_router(payment_router)
app.include_router(admin_router)
