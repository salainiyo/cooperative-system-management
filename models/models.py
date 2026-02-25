from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from pydantic import BaseModel, computed_field
from sqlmodel import Field, Relationship, SQLModel

from dependancies.dependancies import utc_now

# 1. PAYMENT MODELS

class BasePayments(SQLModel):
    # Split buckets for the 1.5% declining balance interest
    principal_amount: Decimal = Field(
        default=Decimal("0.00"), max_digits=12, decimal_places=2
    )
    interest_amount: Decimal = Field(
        default=Decimal("0.00"), max_digits=12, decimal_places=2
    )
    late_fee_amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    paid_at: datetime = Field(default_factory=utc_now)

    @computed_field
    @property
    def total_amount(self) -> Decimal:
        return self.principal_amount + self.interest_amount + self.late_fee_amount


class Payments(BasePayments, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id", ondelete="CASCADE")

    # Relationships
    loan: Optional["Loan"] = Relationship(back_populates="payments")


class CreatePayments(SQLModel):
    # The frontend just sends the total cash amount the user is handing over
    amount: Decimal = Field(max_digits=12, decimal_places=2)


class PublicPayments(BasePayments):
    id: int
    loan_id: int

class PaymentUpdate(SQLModel):
    amount: Decimal|None

class PaymentDelete(SQLModel):
    member_names: str
    payment_amount: Decimal
    
    
# 2. LOAN MODELS

class BaseLoan(SQLModel):
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    monthly_payment: Decimal = Field(
        max_digits=12, decimal_places=2, description="Agreed monthly installment"
    )


class Loan(BaseLoan, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    approved_at: datetime = Field(default_factory=utc_now)
    status: str = Field(default="active")
    member_id: int = Field(foreign_key="member.id", ondelete="CASCADE")

    # Relationships
    member: Optional["Member"] = Relationship(back_populates="loans")
    payments: List["Payments"] = Relationship(
        back_populates="loan", cascade_delete=True
    )

    # --- BUSINESS LOGIC (Dynamic Properties) ---
    @property
    def remaining_balance(self) -> Decimal:
        """Total loan amount minus ONLY the principal paid so far."""
        total_principal_paid = sum(
            (p.principal_amount for p in self.payments), Decimal("0.00")
        )
        return self.amount - total_principal_paid

    @property
    def current_interest_due(self) -> Decimal:
        """Calculates the 1.5% interest on the exact remaining balance."""
        if self.status == "paid" or self.remaining_balance <= Decimal("0.00"):
            return Decimal("0.00")

        interest = self.remaining_balance * Decimal("0.015")
        return round(interest, 2)

    @property
    def expected_installments_paid(self) -> int:
        """Calculates how many full monthly payments have been made."""
        if self.monthly_payment <= Decimal("0.00"):
            return 0
        total_cash_paid = sum((p.total_amount for p in self.payments), Decimal("0.00"))
        return int(total_cash_paid // self.monthly_payment)

    @property
    def next_due_date(self) -> date | None:
        """Dynamically calculates the exact date the next payment is required."""
        if self.status == "paid":
            return None
        return self.approved_at.date() + relativedelta(
            months=self.expected_installments_paid + 1
        )

    @property
    def accumulated_late_fees(self) -> Decimal:
        """Calculates the 3% late penalty based on missed monthly payments."""
        if self.status == "paid" or not self.next_due_date:
            return Decimal("0.00")

        today = utc_now().date()
        if today > self.next_due_date:
            months_late = (today.year - self.next_due_date.year) * 12 + (
                today.month - self.next_due_date.month
            )
            if today.day >= self.next_due_date.day:
                months_late += 1

            if months_late > 0:
                penalty = (
                    self.monthly_payment * Decimal("0.03") * Decimal(str(months_late))
                )
                return round(penalty, 2)

        return Decimal("0.00")


class CreateLoan(BaseLoan):
    pass


class PublicLoan(BaseLoan):
    id: int
    member_id: int
    remaining_balance: Decimal | None = Decimal("0.00")
    current_interest_due: Decimal | None = Decimal("0.00")
    accumulated_late_fees: Decimal | None = Decimal("0.00")
    
class LoanUpdate(SQLModel):
    amount: Decimal
    monthly_payment: Decimal
    
class LoanDelete(SQLModel):
    member: str
    amount: Decimal
    payment_times: int
    remaining_amount: Decimal
    


class LoanWithPayments(BaseLoan):
    id: int
    member_id: int
    approved_at: datetime
    status: str
    payments: List[PublicPayments] = []
    
    remaining_balance: Decimal | None = Decimal("0.00")
    current_interest_due: Decimal | None = Decimal("0.00")
    accumulated_late_fees: Decimal | None = Decimal("0.00")
    next_due_date: Optional[date] = None


#Savings models
class MemberSaving(SQLModel):
    amount: Decimal
    
class Savings(MemberSaving, table=True):
    id : int|None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now, sa_column_kwargs={"onupdate":utc_now})
    member_id: int|None = Field(default=None, foreign_key="member.id")
    member: Optional["Member"] = Relationship(back_populates="savings")
    
class SavingsRead(MemberSaving):
    id : int
    amount: Decimal
    created_at: datetime
    updated_at: datetime
    
class SavingsUpdate(SQLModel):
    amount: int|None = None
    
class SavingsDelete(SQLModel):
    member: str
    amount: Decimal

# 3. MEMBER MODELS

class MemberBase(SQLModel):
    first_name: str = Field(index=True)
    last_name: str = Field(index=True)
    date_of_birth: date = Field()
    gender: str = Field()
    phone_number: str = Field(max_length=15, index=True, unique=True)


class MemberCreate(MemberBase):
    pass


class Member(MemberBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(
        default_factory=utc_now, sa_column_kwargs={"onupdate": utc_now}
    )

    # Relationships
    loans: List["Loan"] = Relationship(back_populates="member")
    savings: List["Savings"] = Relationship(back_populates="member", cascade_delete=True)
    
    @property
    def total_savings(self):
        return sum((s.amount for s in self.savings), Decimal("0.00"))


class MemberPublic(MemberBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
class MemberUpdate(SQLModel):
    first_name: str|None = None
    last_name: str|None = None
    date_of_birth: date|None = None
    gender: str|None = None
    phone_number: str|None = None


class MemberDetailed(MemberPublic):
    active_loans: List[LoanWithPayments] = []
    completed_loans: List[LoanWithPayments] = []
    total_savings: Decimal | None = Decimal("0.00")
    
class MemberDeleted(SQLModel):
    first_name: str
    last_name: str


class AdminDashboardStats(BaseModel):
    total_members: int
    total_savings: Decimal
    total_loans_issued_count: int
    total_principal_loaned: Decimal
    total_principal_collected: Decimal
    total_interest_collected: Decimal
    outstanding_principal: Decimal
    projected_late_fees: Decimal