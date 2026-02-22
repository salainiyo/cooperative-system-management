from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, func, or_, select

from core.app_logging import logger
from core.rate_limiting import limiter
from db.database import get_session
from dependancies.admin_auth import admin_required
from models.models import (
    AdminDashboardStats,
    CreateLoan,
    CreatePayments,
    Loan,
    Member,
    MemberCreate,
    MemberDetailed,
    MemberPublic,
    Payments,
    PublicLoan,
    PublicPayments,
)
from models.users import User

member_router = APIRouter(prefix="/member")
loan_router = APIRouter(prefix="/loan")
payment_router = APIRouter(prefix="/payment")
admin_router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# ==========================================
# MEMBER ROUTES
# ==========================================
@member_router.post("/", response_model=MemberPublic, status_code=201)
@limiter.limit("5/minute")
def register_member(
    request: Request,
    member_data: MemberCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    existing_member = session.exec(
        select(Member).where(Member.phone_number == member_data.phone_number)
    ).first()

    if existing_member:
        raise HTTPException(
            status_code=400, detail="Member with this phone number already exists"
        )

    new_member = Member.model_validate(member_data)

    try:
        session.add(new_member)
        session.commit()
        session.refresh(new_member)
        logger.info(f"Admin {admin.email} registered new member: {new_member.id}")
        return new_member
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=400, detail="Data integrity error (possible duplicate)"
        )
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to register member: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@member_router.get("/search", response_model=list[MemberPublic])
@limiter.limit("10/minute")
async def search_members(
    request: Request,
    q: str = Query(..., min_length=2, description="Search by name or phone number"),
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    logger.info(f"Admin {admin.email} initiated search with query: '{q}'")
    try:
        statement = (
            select(Member)
            .where(
                or_(
                    col(Member.first_name).ilike(f"%{q}%"),
                    col(Member.last_name).ilike(f"%{q}%"),
                    col(Member.phone_number).contains(q),
                )
            )
            .limit(10)
        )
        results = session.exec(statement).all()
        return results
    except Exception as e:
        logger.error(f"Database error during search for '{q}': {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing search.")


@member_router.get("/{id}", response_model=MemberDetailed)
@limiter.limit("20/minute")
def get_member_detailed(
    request: Request,
    id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    logger.info(f"Admin {admin.email} requested details for Member ID: {id}")

    statement = (
        select(Member)
        .where(Member.id == id)
        .options(selectinload(Member.loans).selectinload(Loan.payments))  # type: ignore
    )
    member = session.exec(statement).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    active = [loan for loan in member.loans if loan.status == "active"]
    completed = [loan for loan in member.loans if loan.status == "paid"]

    return MemberDetailed.model_validate(
        member, update={"active_loans": active, "completed_loans": completed}
    )


# ==========================================
# LOAN ROUTES
# ==========================================
@loan_router.post("/{member_id}", response_model=PublicLoan, status_code=201)
@limiter.limit("5/minute")
async def register_loan(
    request: Request,
    member_id: int,
    loan_data: CreateLoan,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    statement = (
        select(Member).where(Member.id == member_id).options(selectinload(Member.loans))  # type: ignore
    )
    db_member = session.exec(statement).first()

    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")

    active_loans = [l for l in db_member.loans if l.status == "active"]
    if len(active_loans) >= 1:
        raise HTTPException(
            status_code=400, detail="Member already has an active debt."
        )

    if db_member.savings <= Decimal("0.00"):
        raise HTTPException(
            status_code=400, detail="Member has no savings account balance."
        )

    max_loan_allowed = db_member.savings * Decimal("2.00")
    if loan_data.amount > max_loan_allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Loan exceeds limit. Maximum allowed based on savings is {max_loan_allowed}.",
        )

    if loan_data.monthly_payment > loan_data.amount:
        raise HTTPException(
            status_code=400, detail="Monthly payment cannot exceed the loan amount."
        )

    new_loan = Loan.model_validate(
        loan_data, update={"member_id": member_id, "status": "active"}
    )

    try:
        session.add(new_loan)
        session.commit()
        session.refresh(new_loan)
        logger.info(f"Loan ID {new_loan.id} approved for Member {member_id}")
        return new_loan
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to issue loan: {str(e)}")
        raise HTTPException(status_code=500, detail="Error while processing loan")


# ==========================================
# PAYMENT ROUTES
# ==========================================
@payment_router.post("/{loan_id}", response_model=PublicPayments, status_code=201)
@limiter.limit("10/minute")
def register_payment(
    request: Request,
    loan_id: int,
    payment_data: CreatePayments,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    statement = (
        select(Loan).where(Loan.id == loan_id).options(selectinload(Loan.payments))  # type: ignore
    )
    db_loan = session.exec(statement).first()

    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if db_loan.status == "paid":
        raise HTTPException(status_code=400, detail="This loan is already fully paid.")

    # Calculate required amounts
    interest_due = db_loan.current_interest_due
    total_clearance_amount = (
        db_loan.remaining_balance + interest_due + db_loan.accumulated_late_fees
    )

    if payment_data.amount > total_clearance_amount:
        raise HTTPException(
            status_code=422,
            detail=f"Overpayment! Total to clear the loan (including fees/interest) is {total_clearance_amount}.",
        )

    # Split Logic: Pay interest first, rest goes to principal
    interest_paid = min(payment_data.amount, interest_due)
    principal_paid = payment_data.amount - interest_paid

    new_payment = Payments(
        loan_id=loan_id, principal_amount=principal_paid, interest_amount=interest_paid
    )
    session.add(new_payment)

    # State Update: Check if principal hit zero
    if (db_loan.remaining_balance - principal_paid) <= Decimal("0.00"):
        db_loan.status = "paid"
        logger.info(f"Loan {loan_id} has been fully paid off!")

    try:
        session.commit()
        session.refresh(new_payment)
        logger.info(
            f"Payment recorded: {principal_paid} to Principal, {interest_paid} to Interest."
        )
        return new_payment

    except Exception as e:
        session.rollback()
        logger.error(f"Payment transaction failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Internal server error during payment"
        )


@admin_router.get("/dashboard-stats", response_model=AdminDashboardStats)
@limiter.limit("10/minute")
def get_dashboard_stats(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    logger.info(f"Admin {admin.email} generated the financial dashboard.")

    # 1. DATABASE AGGREGATION (Fast SQL Level calculations)

    # Members & Savings
    total_members = session.exec(select(func.count(Member.id))).one() or 0  # type: ignore
    total_savings = session.exec(select(func.sum(Member.savings))).one() or Decimal(
        "0.00"
    )

    # Loans
    total_loans_count = session.exec(select(func.count(Loan.id))).one() or 0  # type: ignore
    total_principal_loaned = session.exec(
        select(func.sum(Loan.amount))
    ).one() or Decimal("0.00")

    # Payments (Realized Profits & Principal Collected)
    total_principal_collected = session.exec(
        select(func.sum(Payments.principal_amount))
    ).one() or Decimal("0.00")
    total_interest_collected = session.exec(
        select(func.sum(Payments.interest_amount))
    ).one() or Decimal("0.00")

    # 2. PYTHON AGGREGATION (For dynamic @property calculations)

    # We need to fetch active loans WITH their payments to calculate dynamic metrics accurately
    active_loans_statement = (
        select(Loan).where(Loan.status == "active").options(selectinload(Loan.payments))  # type: ignore
    )
    active_loans = session.exec(active_loans_statement).all()

    projected_late_fees = sum(
        (loan.accumulated_late_fees for loan in active_loans), Decimal("0.00")
    )

    # Outstanding Principal is simply Loaned - Collected
    outstanding_principal = total_principal_loaned - total_principal_collected

    # 3. Construct and return the payload
    return AdminDashboardStats(
        total_members=total_members,
        total_savings=round(total_savings, 2),
        total_loans_issued_count=total_loans_count,
        total_principal_loaned=round(total_principal_loaned, 2),
        total_principal_collected=round(total_principal_collected, 2),
        total_interest_collected=round(total_interest_collected, 2),
        outstanding_principal=round(outstanding_principal, 2),
        projected_late_fees=round(projected_late_fees, 2),
    )
