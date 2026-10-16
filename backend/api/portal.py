from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from core.app_logging import logger
from core.rate_limiting import limiter
from core.settings_cache import get_interest_rate, get_loan_savings_multiplier
from db.database import get_session
from dependancies.auth import current_user
from models.models import (
    Loan,
    LoanRequest,
    LoanRequestCreate,
    LoanRequestPublic,
    LoanWithPayments,
    Member,
    MemberDetailed,
    Savings,
    SavingsRead,
)
from models.users import User

portal_router = APIRouter(prefix="/portal", tags=["Member Portal"])


def get_portal_member(
    user: User = Depends(current_user), session: Session = Depends(get_session)
) -> Member:
    """Authenticated user must be linked to a member record."""
    if user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators do not have a member portal profile.",
        )

    member = session.exec(select(Member).where(Member.user_id == user.id)).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No member profile is linked to this account. Contact the cooperative office.",
        )
    return member


def _loan_public(loan: Loan) -> LoanWithPayments:
    return LoanWithPayments.model_validate(loan)


def _request_public(loan_request: LoanRequest, member: Member | None = None) -> LoanRequestPublic:
    name = None
    if member:
        name = f"{member.first_name} {member.last_name}"
    elif loan_request.member:
        name = f"{loan_request.member.first_name} {loan_request.member.last_name}"
    return LoanRequestPublic.model_validate(
        loan_request, update={"member_name": name}
    )


@portal_router.get("/account")
@limiter.limit("30/minute")
async def portal_account(
    request: Request,
    member: Member = Depends(get_portal_member),
    user: User = Depends(current_user),
):
    return {
        "member_id": member.id,
        "first_name": member.first_name,
        "last_name": member.last_name,
        "phone_number": member.phone_number,
        "date_of_birth": member.date_of_birth,
        "gender": member.gender,
        "joined_at": member.created_at,
        "email": user.email,
        "total_savings": member.total_savings,
    }


@portal_router.get("/savings", response_model=list[SavingsRead])
@limiter.limit("20/minute")
async def portal_savings(
    request: Request,
    member: Member = Depends(get_portal_member),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, le=100),
    session: Session = Depends(get_session),
):
    statement = (
        select(Savings)
        .where(Savings.member_id == member.id)
        .order_by(col(Savings.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    return session.exec(statement).all()


@portal_router.get("/loans")
@limiter.limit("20/minute")
async def portal_loans(
    request: Request,
    member: Member = Depends(get_portal_member),
    session: Session = Depends(get_session),
):
    statement = (
        select(Member)
        .where(Member.id == member.id)
        .options(selectinload(Member.loans).selectinload(Loan.payments))  # type: ignore
    )
    db_member = session.exec(statement).first()
    loans = db_member.loans if db_member else []
    return {
        "active_loans": [_loan_public(l) for l in loans if l.status == "active"],
        "completed_loans": [_loan_public(l) for l in loans if l.status == "paid"],
    }


@portal_router.get("/loan-eligibility")
@limiter.limit("20/minute")
async def portal_loan_eligibility(
    request: Request,
    member: Member = Depends(get_portal_member),
    session: Session = Depends(get_session),
):
    statement = (
        select(Member)
        .where(Member.id == member.id)
        .options(selectinload(Member.loans))  # type: ignore
    )
    db_member = session.exec(statement).first()
    total_savings = db_member.total_savings if db_member else Decimal("0.00")
    multiplier = get_loan_savings_multiplier()
    max_loan_allowed = total_savings * multiplier
    has_active_loan = any(l.status == "active" for l in (db_member.loans if db_member else []))

    can_request = total_savings > 0 and not has_active_loan
    if total_savings <= 0:
        reason = "You need savings in your account before you can request a loan."
    elif has_active_loan:
        reason = "You already have an active loan. Finish repaying it first."
    else:
        reason = None

    return {
        "total_savings": total_savings,
        "max_loan_allowed": max_loan_allowed,
        "has_active_loan": has_active_loan,
        "interest_rate": get_interest_rate(),
        "loan_savings_multiplier": multiplier,
        "can_request": can_request,
        "reason": reason,
    }


@portal_router.post("/loan-requests", response_model=LoanRequestPublic, status_code=201)
@limiter.limit("5/minute")
async def portal_create_loan_request(
    request: Request,
    loan_request_data: LoanRequestCreate,
    member: Member = Depends(get_portal_member),
    session: Session = Depends(get_session),
):
    eligibility = await portal_loan_eligibility(request, member, session)
    if not eligibility["can_request"]:
        raise HTTPException(status_code=400, detail=eligibility["reason"])

    if loan_request_data.amount > eligibility["max_loan_allowed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Requested amount exceeds your limit of {eligibility['max_loan_allowed']} RWF.",
        )

    if loan_request_data.monthly_payment > loan_request_data.amount:
        raise HTTPException(
            status_code=400, detail="Monthly payment cannot exceed the requested amount."
        )

    pending = session.exec(
        select(LoanRequest).where(
            LoanRequest.member_id == member.id, LoanRequest.status == "pending"
        )
    ).first()
    if pending:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending loan request. Wait for the office to review it.",
        )

    new_request = LoanRequest.model_validate(
        loan_request_data, update={"member_id": member.id, "status": "pending"}
    )
    session.add(new_request)
    try:
        session.commit()
        session.refresh(new_request)
    except Exception as e:
        session.rollback()
        logger.error(f"Loan request creation failed for member {member.id}: {e}")
        raise HTTPException(status_code=500, detail="Could not submit the loan request.")

    logger.info(
        f"Member {member.id} submitted loan request #{new_request.id} "
        f"for {new_request.amount} RWF."
    )
    return _request_public(new_request, member)


@portal_router.get("/loan-requests", response_model=list[LoanRequestPublic])
@limiter.limit("20/minute")
async def portal_list_loan_requests(
    request: Request,
    member: Member = Depends(get_portal_member),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(LoanRequest)
        .where(LoanRequest.member_id == member.id)
        .order_by(LoanRequest.requested_at.desc())
    ).all()
    return [_request_public(r, member) for r in rows]
