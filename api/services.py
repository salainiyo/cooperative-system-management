from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
    MemberUpdate,
    MemberDeleted,
    MemberPublic,
    Payments,
    PublicLoan,
    PublicPayments,
    Savings,
    MemberSaving,
    SavingsRead,
    SavingsUpdate
)
from models.users import User

member_router = APIRouter(prefix="/member")
loan_router = APIRouter(prefix="/loan")
payment_router = APIRouter(prefix="/payment")
admin_router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])
savings_router = APIRouter(prefix="/savings")


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
    
@member_router.patch("/update/{member_id}", response_model=MemberPublic, status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def update_member(
    request: Request,
    member_id: int,
    member_update_data: MemberUpdate,
    admin: User = Depends(admin_required),
    session: Session = Depends(get_session)
):
    logger.info(f"Admin {admin.email} is attempting to update Member #{member_id}")
    
    # 1. Fetch the existing database object
    member_db = session.get(Member, member_id)
    if not member_db:
        logger.warning(f"Update failed: Member #{member_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
        
    # 2. Extract ONLY the fields the user actually provided in the request
    update_dict = member_update_data.model_dump(exclude_unset=True)
    
    # Check if they actually sent anything to update!
    if not update_dict:
        logger.info(f"No new data provided for Member #{member_id}. Skipping update.")
        return member_db

    # 3. Apply the dictionary values to the database object
    member_db.sqlmodel_update(update_dict)
    
    # 4. Save the DATABASE OBJECT (member_db), not the dictionary!
    try:
        session.add(member_db)
        session.commit()
        session.refresh(member_db)
        logger.info(f"Successfully updated Member #{member_id}. Fields changed: {list(update_dict.keys())}")
        return member_db
        
    except IntegrityError:
        session.rollback()
        logger.error(f"Update failed for Member #{member_id}: Integrity Error (Likely a duplicate phone number)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update failed. The provided data (e.g., phone number) may already be in use."
        )
    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error while updating Member #{member_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during update."
        )
        
@member_router.delete("/delete/{member_id}", response_model=MemberDeleted, status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def delete_member(
    request: Request, # Required by the limiter!
    member_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.warning(f"Admin {admin.email} initiated deletion for Member #{member_id}")

    db_member = session.get(Member, member_id)
    if not db_member:
        logger.error(f"Deletion failed: Member #{member_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    try:
        session.delete(db_member)
        session.commit()
        logger.info(f"Successfully deleted Member #{member_id} ({db_member.first_name} {db_member.last_name}) and all associated records.")
        return db_member
        
    except Exception as e:
        session.rollback()
        logger.error(f"Database error during deletion of Member #{member_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during deletion."
        )
        
# ==========================================
# SAVINGS ROUTES
# ==========================================
@savings_router.post("/{member_id}", response_model=SavingsRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def record_savings(
    request: Request,
    member_id: int,
    savings_data: MemberSaving,
    admin: User = Depends(admin_required),
    session: Session = Depends(get_session)
):
    logger.info(f"Admin {admin.email} is recording a deposit for Member #{member_id}")

    # 1. Verify the member exists
    db_member = session.get(Member, member_id)
    if not db_member:
        logger.warning(f"Deposit failed: Member #{member_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
        
    # 2. Bind the deposit to the member
    new_savings = Savings.model_validate(savings_data, update={"member_id": member_id})
    
    # 3. Save to database safely
    try:
        session.add(new_savings)
        session.commit()
        session.refresh(new_savings)
        
        logger.info(f"Successfully recorded a {new_savings.amount} deposit for Member #{member_id}.")
        return new_savings
        
    except IntegrityError:
        session.rollback()
        logger.error(f"Integrity Error recording savings for Member #{member_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error."
        )
        
    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error recording savings for Member #{member_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during deposit."
        )
        
from fastapi import Query # <-- Add this to your imports!

@savings_router.get("/{member_id}", response_model=list[SavingsRead])
@limiter.limit("5/minute")
async def get_members_savings(
    request: Request,
    member_id: int,
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=10, le=100, description="Max records to return (max 100)"),
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.info(f"Admin {admin.email} requesting savings for Member #{member_id} (skip={skip}, limit={limit})")

    db_member = session.get(Member, member_id)
    if not db_member:
        logger.warning(f"Fetch failed: Member #{member_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    try:
        statement = (
            select(Savings)
            .where(Savings.member_id == member_id)
            .order_by(col(Savings.updated_at).desc())
            .offset(skip)
            .limit(limit)
        )
        member_savings = session.exec(statement).all()
        
        logger.info(f"Successfully retrieved {len(member_savings)} savings records for Member #{member_id}.")
        return member_savings
        
    except Exception as e:
        logger.error(f"Database error while fetching savings for Member #{member_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while retrieving savings."
        )
        
@savings_router.patch("/{savings_id}", response_model=SavingsRead, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def update_savings(
    request: Request, # <-- CRITICAL FIX: Required by the rate limiter
    savings_id: int,
    savings_update: SavingsUpdate, # Renamed slightly for clarity
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.info(f"Admin {admin.email} is attempting to update Savings record #{savings_id}")

    # 1. Verify the savings record exists
    db_savings = session.get(Savings, savings_id)
    if not db_savings:
        logger.warning(f"Update failed: Savings record #{savings_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings record not found"
        )
    
    # 2. Extract only the fields provided by the user
    update_data = savings_update.model_dump(exclude_unset=True)
    
    # 3. Check if they actually sent anything to change
    if not update_data:
        logger.info(f"No new data provided for Savings record #{savings_id}. Skipping commit.")
        return db_savings

    try:
        # 4. Apply changes to the object in memory
        db_savings.sqlmodel_update(update_data)
        
        # 5. CRITICAL FIX: Actually save the changes to the database!
        session.add(db_savings)
        session.commit()
        session.refresh(db_savings)
        
        logger.info(f"Successfully updated Savings record #{savings_id}. Fields changed: {list(update_data.keys())}")
        return db_savings
    
    except IntegrityError:
        session.rollback()
        logger.error(f"Integrity Error while updating Savings record #{savings_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error. Verify the provided data."
        )
    
    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error updating Savings record #{savings_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during update."
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
        
@payment_router.get("/", response_model=list[PublicPayments])
@limiter.limit("10/minute")
def get_all_payments(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    logger.info(f"Admin {admin.email} requested the payments log.")
    # Fetch all payments, ordering by the newest first
    statement = select(Payments).order_by(col(Payments.id).desc())
    results = session.exec(statement).all()
    return results


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
