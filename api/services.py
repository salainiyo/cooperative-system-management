from decimal import Decimal
from typing import Dict, Any

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
    LoanUpdate,
    LoanDelete,
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
    PaymentUpdate,
    PaymentDelete,
    Savings,
    MemberSaving,
    SavingsRead,
    SavingsUpdate,
    SavingsDelete
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

@member_router.get("/", response_model=Dict[str, Any])
@limiter.limit("20/minute")
def get_all_members(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
    offset: int = 0,
    limit: int = 20
):
    """
    Retrieves a paginated list of members. 
    Includes rate-limiting, input validation, and detailed logging.
    """
    # 1. Input Validation & Exception Handling
    if offset < 0:
        logger.warning(f"Admin {admin.email} provided negative offset: {offset}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Offset cannot be negative."
        )
    
    # Cap the limit to prevent huge memory spikes
    if limit > 100:
        logger.warning(f"Admin {admin.email} requested excessive limit: {limit}. Capping to 100.")
        limit = 100
    if limit <= 0:
        limit = 20

    try:
        logger.info(f"FETCH_MEMBERS: Admin {admin.email} fetching batch (offset={offset}, limit={limit})")

        # 2. Get total count (using func.count() is much faster than len(all_results))
        total_statement = select(func.count()).select_from(Member)
        total_count = session.exec(total_statement).one()
        
        # 3. Fetch the specific slice
        statement = (
            select(Member)
            .order_by(col(Member.created_at).desc())
            .offset(offset)
            .limit(limit)
        )
        results = session.exec(statement).all()

        logger.info(f"FETCH_SUCCESS: Successfully retrieved {len(results)} members for {admin.email}.")

        return {
            "members": results,
            "total_count": total_count,
            "offset": offset,
            "limit": limit
        }

    except Exception as e:
        # Catch-all for database connection errors or query failures
        logger.error(f"DATABASE_ERROR: Error retrieving members for {admin.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal database error occurred while fetching members."
        )

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
        
@member_router.delete("/{member_id}", response_model=MemberDeleted, status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def delete_member(
    request: Request,
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
        
    # ==========================================
    # FINANCIAL SAFEGUARDS (The "Safe Delete" Rules)
    # ==========================================
    
    # 1. PRIORITY CHECK: Do they owe us money? (Active Loans)
    has_active_loan = False
    if hasattr(db_member, "loans"):
        for loan in db_member.loans:
            if getattr(loan, "status", "") != "paid":
                has_active_loan = True
                break
                
    if has_active_loan:
        logger.error(f"Deletion blocked: Member #{member_id} has an active loan.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete member. They have an active loan that must be paid first."
        )

    # 2. SECONDARY CHECK: Do we owe them money? (Savings)
    has_savings = getattr(db_member, "total_savings", 0) > 0
    if not has_savings and hasattr(db_member, "savings"):
        has_savings = sum(s.amount for s in db_member.savings) > 0
        
    if has_savings:
        logger.error(f"Deletion blocked: Member #{member_id} still has savings.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete member. They still have savings in the cooperative."
        )
        
    # ==========================================

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
    request: Request,
    savings_id: int,
    savings_update: SavingsUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.info(f"Admin {admin.email} is attempting to update Savings record #{savings_id}")

    db_savings = session.get(Savings, savings_id)
    if not db_savings:
        logger.warning(f"Update failed: Savings record #{savings_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings record not found"
        )
    
    update_data = savings_update.model_dump(exclude_unset=True)
    
    if not update_data:
        logger.info(f"No new data provided for Savings record #{savings_id}. Skipping commit.")
        return db_savings

    try:
        db_savings.sqlmodel_update(update_data)
        
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
        
@savings_router.delete("/{savings_id}", response_model=SavingsDelete, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def delete_savings(
    request: Request,
    savings_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.warning(f"Admin {admin.email} initiated deletion for Savings record #{savings_id}")

    db_savings = session.get(Savings, savings_id)
    if not db_savings:
        logger.error(f"Deletion failed: Savings record #{savings_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings record not found"
        )
        
    # (Using a fallback just in case the database relationship is missing)
    first_name = db_savings.member.first_name if db_savings.member else "Unknown"
    last_name = db_savings.member.last_name if db_savings.member else "Member"
    full_name = f"{first_name} {last_name}"
    
    amount_deleted = db_savings.amount
    
    response_data = SavingsDelete(member=full_name, amount=amount_deleted)

    try:
        session.delete(db_savings)
        session.commit()
        
        logger.info(f"Successfully deleted {amount_deleted} RWF savings record #{savings_id} for {full_name}.")
        return response_data
        
    except Exception as e:
        session.rollback()
        logger.error(f"Database error during deletion of Savings record #{savings_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during deletion."
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

    if db_member.total_savings <= Decimal("0.00"):
        raise HTTPException(
            status_code=400, detail="Member has no savings account balance."
        )

    max_loan_allowed = db_member.total_savings * Decimal("2.00")
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
    
@loan_router.patch("/{loan_id}", response_model=PublicLoan, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def update_loan(
    request: Request,
    loan_id: int,
    update_loan_data: LoanUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.info(f"Admin {admin.email} is attempting to update Loan #{loan_id}")

    db_loan = session.get(Loan, loan_id)
    if not db_loan:
        logger.warning(f"Update failed: Loan #{loan_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found"
        )
        
    loan_data = update_loan_data.model_dump(exclude_unset=True)
    
    if not loan_data:
        logger.info(f"No new data provided for Loan #{loan_id}. Skipping commit.")
        return db_loan

    try:
        db_loan.sqlmodel_update(loan_data)
        session.add(db_loan)
        session.commit()
        session.refresh(db_loan)
        
        logger.info(f"Successfully updated Loan #{loan_id}. Fields changed: {list(loan_data.keys())}")
        return db_loan
        
    except IntegrityError:
        session.rollback()
        logger.error(f"Integrity Error updating Loan #{loan_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error. Check if the provided data is valid."
        )
        
    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error updating Loan #{loan_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during loan update."
        )
        
@loan_router.delete("/{loan_id}", response_model=LoanDelete, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def delete_loan(
    request: Request,
    loan_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.warning(f"Admin {admin.email} initiated deletion for Loan #{loan_id}")

    db_loan = session.get(Loan, loan_id)
    if not db_loan:
        logger.error(f"Deletion failed: Loan #{loan_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found"
        )
        
    first_name = db_loan.member.first_name if db_loan.member else "Unknown"
    last_name = db_loan.member.last_name if db_loan.member else "Member"
    full_name = f"{first_name} {last_name}"
    
    payments_made = len(db_loan.payments) if db_loan.payments else 0
    loan_amount = db_loan.amount
    remaining_balance = db_loan.remaining_balance
    
    loan_to_be_deleted = LoanDelete(
        member=full_name,
        amount=loan_amount,
        payment_times=payments_made,
        remaining_amount=remaining_balance
    )
    
    try:
        session.delete(db_loan)
        session.commit()
        
        logger.info(f"Successfully deleted Loan #{loan_id} ({loan_amount} RWF) for {full_name}.")
        return loan_to_be_deleted
        
    except Exception as e:
        session.rollback()
        logger.error(f"Database error during deletion of Loan #{loan_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during loan deletion."
        )
    
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

    # --- THE WATERFALL PAYMENT LOGIC ---
    current_cash = payment_data.amount

    # 1. Pay off late fees first
    late_fees_due = db_loan.accumulated_late_fees
    late_fees_paid = min(current_cash, late_fees_due)
    current_cash -= late_fees_paid

    # 2. Pay off interest second
    interest_due = db_loan.current_interest_due
    interest_paid = min(current_cash, interest_due)
    current_cash -= interest_paid

    # 3. Whatever is left goes to the principal
    principal_paid = current_cash

    new_payment = Payments(
        loan_id=loan_id, 
        principal_amount=principal_paid, 
        interest_amount=interest_paid,
        late_fee_amount=late_fees_paid
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
        
@payment_router.patch("/{payment_id}", response_model=PublicPayments, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def update_payment(
    request: Request,
    payment_id: int,
    payment_update: PaymentUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.info(f"Admin {admin.email} is attempting to update amount for Payment #{payment_id}")

    # 1. Fetch Payment AND the associated Loan
    statement = select(Payments).where(Payments.id == payment_id).options(selectinload(Payments.loan))#type: ignore
    db_payment = session.exec(statement).first()
    
    if not db_payment or not db_payment.loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment or associated loan not found")

    loan = db_payment.loan

    # 2. Reconstruct the "Pre-Payment" mathematical state
    # We find out what the loan looked like mathematically BEFORE this specific payment existed
    pre_payment_principal = loan.remaining_balance + db_payment.principal_amount
    pre_payment_interest = round(pre_payment_principal * Decimal("0.015"), 2)
    pre_payment_late_fees = loan.accumulated_late_fees + db_payment.late_fee_amount
    
    total_clearance_needed = pre_payment_principal + pre_payment_interest + pre_payment_late_fees

    # 3. Check for Overpayment
    new_amount = payment_update.amount
    if new_amount > total_clearance_needed: #type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Overpayment! The max debt (including this payment) is {total_clearance_needed} RWF."
        )

    # 4. Re-Run the Waterfall Logic with the NEW Amount
    cash_remaining = new_amount

    new_late_fee_part = min(cash_remaining, pre_payment_late_fees) #type: ignore
    cash_remaining -= new_late_fee_part #type: ignore

    new_interest_part = min(cash_remaining, pre_payment_interest)
    cash_remaining -= new_interest_part

    new_principal_part = cash_remaining

    try:
        # 5. Update the physical database columns for the payment
        # (We do NOT touch loan.remaining_balance or payment.total_amount because they are dynamic @properties!)
        db_payment.late_fee_amount = new_late_fee_part
        db_payment.interest_amount = new_interest_part
        db_payment.principal_amount = new_principal_part
        
        # Save the payment first so the Loan properties can auto-calculate based on the new data
        session.add(db_payment)
        session.commit()
        
        # 6. Check if the loan is now paid off based on the newly auto-calculated remaining balance!
        if loan.remaining_balance <= Decimal("0.00"):
            loan.status = "paid"
        else:
            loan.status = "active"
            
        session.add(loan)
        session.commit()
        session.refresh(db_payment)
        
        logger.info(f"Payment #{payment_id} recalculated: {new_amount} RWF -> Fees: {new_late_fee_part}, Int: {new_interest_part}, Prin: {new_principal_part}")
        return db_payment

    except Exception as e:
        session.rollback()
        logger.error(f"Error recalculating Payment #{payment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during payment recalculation."
        )
        
@payment_router.delete("/{payment_id}", response_model=PaymentDelete, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def delete_payment(
    request: Request,
    payment_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    logger.warning(f"Admin {admin.email} initiated deletion for Payment #{payment_id}")

    db_payment = session.get(Payments, payment_id)
    if not db_payment:
        logger.error(f"Deletion failed: Payment #{payment_id} not found.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
        
    # 1. Safely navigate the relationships to avoid AttributeError crashes
    loan = db_payment.loan
    member = loan.member if loan else None
    first_name = member.first_name if member else "Unknown"
    last_name = member.last_name if member else "Member"
    
    amount = db_payment.total_amount
    
    deleted_payment = PaymentDelete(
        member_names=f"{first_name} {last_name}",
        payment_amount=amount
    )
    
    try:
        # 2. THE FIX: If the loan was 'paid', deleting this payment means 
        # they likely owe money again. Revert the status to 'active'.
        if loan and loan.status == "paid":
            loan.status = "active"
            session.add(loan)
            logger.info(f"Loan #{loan.id} status automatically reverted to 'active'.")

        # 3. Delete the payment
        session.delete(db_payment)
        session.commit()
        
        logger.info(f"Successfully deleted {amount} RWF payment #{payment_id} for {first_name} {last_name}.")
        return deleted_payment
        
    except Exception as e:
        session.rollback()
        logger.error(f"Database error during deletion of Payment #{payment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during payment deletion."
        )
        
#=======================================================
#ADMIN ROUTES
#======================================================
@admin_router.get("/dashboard-stats", response_model=AdminDashboardStats, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def get_dashboard_stats(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    logger.info(f"Admin {admin.email} generated the financial dashboard.")

    try:
        # 1. DATABASE AGGREGATION (Lightning fast SQL Level calculations)

        # Members
        total_members = session.exec(select(func.count(Member.id))).one() or 0 #type: ignore
        
        # THE FIX: Sum the actual 'amount' column from the Savings table
        total_savings = session.exec(select(func.sum(Savings.amount))).one() or Decimal("0.00")

        # Loans
        total_loans_count = session.exec(select(func.count(Loan.id))).one() or 0 #type: ignore
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

        # Fetch active loans WITH their payments to calculate dynamic metrics accurately
        active_loans_statement = (
            select(Loan)
            .where(Loan.status == "active")
            .options(selectinload(Loan.payments))#type: ignore
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

    except Exception as e:
        logger.error(f"Failed to generate dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while generating dashboard statistics."
        )