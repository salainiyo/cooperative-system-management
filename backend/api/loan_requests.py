from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from core.app_logging import logger
from core.email_service import (
    EmailNotConfiguredError,
    EmailSendError,
    get_active_smtp_settings,
    render_simple_email,
    send_email,
)
from core.rate_limiting import limiter
from core.settings_cache import get_loan_savings_multiplier
from db.database import get_session
from dependancies.admin_auth import admin_required
from dependancies.dependancies import utc_now
from models.models import Loan, LoanRequest, LoanRequestDecision, LoanRequestPublic, Member
from models.users import User

loan_requests_admin_router = APIRouter(
    prefix="/admin/loan-requests", tags=["Admin Loan Requests"]
)


def _to_public(r: LoanRequest, member: Member | None = None) -> LoanRequestPublic:
    name = None
    if member:
        name = f"{member.first_name} {member.last_name}"
    return LoanRequestPublic.model_validate(r, update={"member_name": name})


def _notify_member_decision(member: Member, email: str, approved: bool, note: str | None, amount) -> None:
    settings = get_active_smtp_settings()
    if not settings or not settings.smtp_email or not settings.smtp_password_encrypted:
        return
    heading = "Loan request approved" if approved else "Loan request update"
    lines = [
        f"Hello {member.first_name} {member.last_name},",
        (
            f"Your loan request for {amount} RWF has been <strong>approved</strong>."
            if approved
            else f"Your loan request for {amount} RWF was not approved."
        ),
    ]
    if note:
        lines.append(f"Note from the office: {note}")
    try:
        send_email(email, heading, render_simple_email(heading, lines))
    except (EmailNotConfiguredError, EmailSendError) as e:
        logger.warning(f"Could not email decision to {email}: {e}")


@loan_requests_admin_router.get("", response_model=list[LoanRequestPublic])
@limiter.limit("20/minute")
async def list_loan_requests(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    statement = select(LoanRequest).options(selectinload(LoanRequest.member))  # type: ignore
    if status_filter:
        statement = statement.where(LoanRequest.status == status_filter)
    statement = statement.order_by(LoanRequest.requested_at.desc())
    rows = session.exec(statement).all()
    return [_to_public(r, r.member) for r in rows]


@loan_requests_admin_router.post("/{request_id}/approve", response_model=LoanRequestPublic)
@limiter.limit("10/minute")
async def approve_loan_request(
    request: Request,
    request_id: int,
    decision: LoanRequestDecision,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    loan_request = session.get(LoanRequest, request_id)
    if not loan_request:
        raise HTTPException(status_code=404, detail="Loan request not found")
    if loan_request.status != "pending":
        raise HTTPException(
            status_code=409, detail=f"This request is already {loan_request.status}."
        )

    statement = (
        select(Member)
        .where(Member.id == loan_request.member_id)
        .options(selectinload(Member.loans))  # type: ignore
    )
    member = session.exec(statement).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Re-run the full issuance eligibility at approval time.
    if any(l.status == "active" for l in member.loans):
        raise HTTPException(
            status_code=400,
            detail="Member already has an active loan. Reject this request instead.",
        )
    if member.total_savings <= Decimal("0.00"):
        raise HTTPException(
            status_code=400, detail="Member has no savings balance; cannot disburse a loan."
        )
    max_loan_allowed = member.total_savings * get_loan_savings_multiplier()
    if loan_request.amount > max_loan_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Amount exceeds the member's limit of {max_loan_allowed} RWF based on current savings.",
        )
    if loan_request.monthly_payment > loan_request.amount:
        raise HTTPException(
            status_code=400, detail="Monthly payment cannot exceed the loan amount."
        )

    new_loan = Loan(
        amount=loan_request.amount,
        monthly_payment=loan_request.monthly_payment,
        member_id=member.id,  # type: ignore
        status="active",
    )
    session.add(new_loan)
    loan_request.status = "approved"
    loan_request.decided_at = utc_now()
    loan_request.decided_by = admin.id
    loan_request.decision_note = decision.note
    loan_request.loan_id = None  # set after flush
    session.add(loan_request)
    try:
        session.commit()
        session.refresh(new_loan)
        loan_request.loan_id = new_loan.id
        session.add(loan_request)
        session.commit()
        session.refresh(loan_request)
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to approve loan request #{request_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not approve the request.")

    member_user = session.get(User, member.user_id) if member.user_id else None
    if member_user:
        _notify_member_decision(member, member_user.email, True, decision.note, loan_request.amount)

    logger.info(
        f"Admin {admin.email} approved loan request #{request_id} → loan #{new_loan.id}"
    )
    return _to_public(loan_request, member)


@loan_requests_admin_router.post("/{request_id}/reject", response_model=LoanRequestPublic)
@limiter.limit("10/minute")
async def reject_loan_request(
    request: Request,
    request_id: int,
    decision: LoanRequestDecision,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    loan_request = session.get(LoanRequest, request_id)
    if not loan_request:
        raise HTTPException(status_code=404, detail="Loan request not found")
    if loan_request.status != "pending":
        raise HTTPException(
            status_code=409, detail=f"This request is already {loan_request.status}."
        )

    member = session.get(Member, loan_request.member_id)
    loan_request.status = "rejected"
    loan_request.decided_at = utc_now()
    loan_request.decided_by = admin.id
    loan_request.decision_note = decision.note
    session.add(loan_request)
    try:
        session.commit()
        session.refresh(loan_request)
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to reject loan request #{request_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not reject the request.")

    if member and member.user_id:
        member_user = session.get(User, member.user_id)
        if member_user:
            _notify_member_decision(member, member_user.email, False, decision.note, loan_request.amount)

    logger.info(f"Admin {admin.email} rejected loan request #{request_id}")
    return _to_public(loan_request, member)
