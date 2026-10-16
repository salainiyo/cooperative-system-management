import csv
import io
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, func, select

from core.app_logging import logger
from core.rate_limiting import limiter
from db.database import get_session
from dependancies.admin_auth import admin_required
from dependancies.dependancies import utc_now
from models.models import Loan, Member, Payments, PublicLoan, Savings
from models.users import User

reports_router = APIRouter(prefix="/admin", tags=["Reports & Exports"])


def _parse_date(value: Optional[str], field_name: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid {field_name}: expected YYYY-MM-DD.")


def _active_loans_with_payments(session: Session) -> list[Loan]:
    return session.exec(
        select(Loan)
        .where(Loan.status == "active")
        .options(selectinload(Loan.payments), selectinload(Loan.member))  # type: ignore
    ).all()


@reports_router.get("/reports/portfolio")
@limiter.limit("10/minute")
async def portfolio_report(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Arrears aging buckets + Portfolio-at-Risk for active loans."""
    active = _active_loans_with_payments(session)
    today = utc_now().date()

    buckets = {"current": [], "1-30": [], "31-60": [], "61-90": [], "90+": []}
    total_active_principal = Decimal("0.00")
    overdue_principal = Decimal("0.00")

    for loan in active:
        balance = loan.remaining_balance
        total_active_principal += balance

        next_due = loan.next_due_date
        days_overdue = (today - next_due).days if next_due and today > next_due else 0

        if days_overdue <= 0:
            key = "current"
        elif days_overdue <= 30:
            key = "1-30"
        elif days_overdue <= 60:
            key = "31-60"
        elif days_overdue <= 90:
            key = "61-90"
        else:
            key = "90+"

        entry = {
            "loan_id": loan.id,
            "member_id": loan.member_id,
            "member_name": f"{loan.member.first_name} {loan.member.last_name}" if loan.member else None,
            "remaining_balance": balance,
            "next_due_date": next_due.isoformat() if next_due else None,
            "days_overdue": days_overdue,
            "late_fees": loan.accumulated_late_fees,
        }
        buckets[key].append(entry)
        if days_overdue > 0:
            overdue_principal += balance

    par_ratio = (overdue_principal / total_active_principal) if total_active_principal > 0 else Decimal("0.00")

    return {
        "as_of": today.isoformat(),
        "total_active_principal": round(total_active_principal, 2),
        "overdue_principal": round(overdue_principal, 2),
        "par_ratio": round(par_ratio, 4),
        "buckets": {
            name: {
                "count": len(rows),
                "principal": round(sum((r["remaining_balance"] for r in rows), Decimal("0.00")), 2),
                "loans": rows,
            }
            for name, rows in buckets.items()
        },
    }


@reports_router.get("/reports/collections")
@limiter.limit("10/minute")
async def collections_report(
    request: Request,
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Active loans (for the collections radar) or payments in a date range when both dates given."""
    start = _parse_date(date_from, "from")
    end = _parse_date(date_to, "to")

    if start and end:
        start_dt = datetime.combine(start, datetime.min.time())
        end_dt = datetime.combine(end, datetime.max.time())
        rows = session.exec(
            select(Payments)
            .where(col(Payments.paid_at).between(start_dt, end_dt))
            .options(selectinload(Payments.loan).selectinload(Loan.member))  # type: ignore
            .order_by(col(Payments.paid_at).desc())
        ).all()
        return {
            "mode": "payments",
            "from": start.isoformat(),
            "to": end.isoformat(),
            "payments": [
                {
                    "id": p.id,
                    "loan_id": p.loan_id,
                    "member_id": p.loan.member_id if p.loan else None,
                    "member_name": (
                        f"{p.loan.member.first_name} {p.loan.member.last_name}"
                        if p.loan and p.loan.member
                        else None
                    ),
                    "principal_amount": p.principal_amount,
                    "interest_amount": p.interest_amount,
                    "late_fee_amount": p.late_fee_amount,
                    "total_amount": p.total_amount,
                    "paid_at": p.paid_at,
                }
                for p in rows
            ],
        }

    # Default mode: all active loans with member info in ONE query (replaces the old N+1 fetch).
    today = utc_now().date()
    active = _active_loans_with_payments(session)
    return {
        "mode": "active_loans",
        "as_of": today.isoformat(),
        "loans": [
            {
                "loan_id": loan.id,
                "member_id": loan.member_id,
                "member_name": f"{loan.member.first_name} {loan.member.last_name}" if loan.member else None,
                "phone_number": loan.member.phone_number if loan.member else None,
                "amount": loan.amount,
                "monthly_payment": loan.monthly_payment,
                "remaining_balance": loan.remaining_balance,
                "current_interest_due": loan.current_interest_due,
                "accumulated_late_fees": loan.accumulated_late_fees,
                "next_due_date": loan.next_due_date.isoformat() if loan.next_due_date else None,
                "days_overdue": (
                    (today - loan.next_due_date).days
                    if loan.next_due_date and today > loan.next_due_date
                    else 0
                ),
                "approved_at": loan.approved_at,
            }
            for loan in active
        ],
    }


@reports_router.get("/members/{member_id}/statement")
@limiter.limit("10/minute")
async def member_statement(
    request: Request,
    member_id: int,
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    start = _parse_date(date_from, "from")
    end = _parse_date(date_to, "to")

    savings_statement = select(Savings).where(Savings.member_id == member_id)
    payments_statement = (
        select(Payments)
        .join(Loan, Payments.loan_id == Loan.id)
        .where(Loan.member_id == member_id)
        .options(selectinload(Payments.loan))  # type: ignore
    )

    if start:
        start_dt = datetime.combine(start, datetime.min.time())
        savings_statement = savings_statement.where(col(Savings.created_at) >= start_dt)
        payments_statement = payments_statement.where(col(Payments.paid_at) >= start_dt)
    if end:
        end_dt = datetime.combine(end, datetime.max.time())
        savings_statement = savings_statement.where(col(Savings.created_at) <= end_dt)
        payments_statement = payments_statement.where(col(Payments.paid_at) <= end_dt)

    savings_rows = session.exec(savings_statement.order_by(col(Savings.created_at).asc())).all()  # type: ignore
    payment_rows = session.exec(payments_statement.order_by(col(Payments.paid_at).asc())).all()  # type: ignore

    total_deposits = sum((s.amount for s in savings_rows if s.transaction_type == "deposit"), Decimal("0.00"))
    total_withdrawals = sum((s.amount for s in savings_rows if s.transaction_type == "withdrawal"), Decimal("0.00"))

    return {
        "member": {
            "id": member.id,
            "name": f"{member.first_name} {member.last_name}",
            "phone_number": member.phone_number,
            "joined_at": member.created_at,
        },
        "period": {"from": start.isoformat() if start else None, "to": end.isoformat() if end else None},
        "savings": [
            {
                "id": s.id,
                "amount": s.amount,
                "transaction_type": s.transaction_type,
                "balance_after": s.balance_after,
                "created_at": s.created_at,
            }
            for s in savings_rows
        ],
        "payments": [
            {
                "id": p.id,
                "loan_id": p.loan_id,
                "principal_amount": p.principal_amount,
                "interest_amount": p.interest_amount,
                "late_fee_amount": p.late_fee_amount,
                "total_amount": p.total_amount,
                "paid_at": p.paid_at,
            }
            for p in payment_rows
        ],
        "summary": {
            "total_deposits": round(total_deposits, 2),
            "total_withdrawals": round(total_withdrawals, 2),
            "total_loan_payments": round(sum((p.total_amount for p in payment_rows), Decimal("0.00")), 2),
            "current_savings_balance": member.total_savings,
        },
    }


# ==========================================
# CSV EXPORTS
# ==========================================
def _csv_response(filename: str, headers: list[str], rows: list[list]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@reports_router.get("/export/{dataset}.csv")
@limiter.limit("10/minute")
async def export_csv(
    request: Request,
    dataset: str,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    if dataset == "members":
        members = session.exec(select(Member).order_by(col(Member.id).asc())).all()
        rows = [
            [m.id, m.first_name, m.last_name, m.phone_number, m.date_of_birth.isoformat(),
             m.gender, str(m.total_savings), m.created_at.isoformat()]
            for m in members
        ]
        return _csv_response(
            "members.csv",
            ["id", "first_name", "last_name", "phone", "date_of_birth", "gender", "total_savings", "joined_at"],
            rows,
        )

    if dataset == "savings":
        savings = session.exec(
            select(Savings).options(selectinload(Savings.member)).order_by(col(Savings.id).asc())  # type: ignore
        ).all()
        rows = [
            [s.id, s.member_id,
             f"{s.member.first_name} {s.member.last_name}" if s.member else "",
             s.transaction_type, str(s.amount),
             str(s.balance_after) if s.balance_after is not None else "",
             s.created_at.isoformat()]
            for s in savings
        ]
        return _csv_response(
            "savings.csv",
            ["id", "member_id", "member_name", "type", "amount", "balance_after", "created_at"],
            rows,
        )

    if dataset == "loans":
        loans = session.exec(
            select(Loan).options(selectinload(Loan.member)).order_by(col(Loan.id).asc())  # type: ignore
        ).all()
        rows = [
            [l.id, l.member_id,
             f"{l.member.first_name} {l.member.last_name}" if l.member else "",
             str(l.amount), str(l.monthly_payment), l.status,
             str(l.remaining_balance), l.approved_at.isoformat()]
            for l in loans
        ]
        return _csv_response(
            "loans.csv",
            ["id", "member_id", "member_name", "amount", "monthly_payment", "status", "remaining_balance", "approved_at"],
            rows,
        )

    if dataset == "payments":
        payments = session.exec(
            select(Payments)
            .options(selectinload(Payments.loan).selectinload(Loan.member))  # type: ignore
            .order_by(col(Payments.id).asc())
        ).all()
        rows = [
            [p.id, p.loan_id,
             p.loan.member_id if p.loan else "",
             f"{p.loan.member.first_name} {p.loan.member.last_name}" if p.loan and p.loan.member else "",
             str(p.principal_amount), str(p.interest_amount), str(p.late_fee_amount),
             str(p.total_amount), p.paid_at.isoformat()]
            for p in payments
        ]
        return _csv_response(
            "payments.csv",
            ["id", "loan_id", "member_id", "member_name", "principal", "interest", "late_fee", "total", "paid_at"],
            rows,
        )

    raise HTTPException(
        status_code=404,
        detail="Unknown export dataset. Use members, savings, loans, or payments.",
    )


# ==========================================
# DASHBOARD TIMESERIES + TREND DELTAS
# ==========================================
@reports_router.get("/dashboard/timeseries")
@limiter.limit("10/minute")
async def dashboard_timeseries(
    request: Request,
    months: int = Query(default=12, ge=1, le=24),
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Monthly savings/loan/collection activity for dashboard charts (SQLite)."""
    today = utc_now().date()
    # The window must END on the current month, otherwise live activity never shows.
    start = today.replace(day=1)
    points = []
    cursor = start
    for _ in range(months):
        points.append(cursor)
        cursor = (cursor.replace(day=1) - timedelta(days=1)).replace(day=1)
    points.reverse()
    start_dt = datetime.combine(points[0], datetime.min.time())

    savings_rows = session.exec(
        select(Savings).where(col(Savings.created_at) >= start_dt)
    ).all()
    payment_rows = session.exec(
        select(Payments).where(col(Payments.paid_at) >= start_dt)
    ).all()
    loan_rows = session.exec(
        select(Loan).where(col(Loan.approved_at) >= start_dt)
    ).all()

    def month_key(dt: datetime) -> str:
        return f"{dt.year:04d}-{dt.month:02d}"

    index = {p.strftime("%Y-%m"): {
        "month": p.strftime("%Y-%m"),
        "deposits": Decimal("0.00"),
        "withdrawals": Decimal("0.00"),
        "principal_disbursed": Decimal("0.00"),
        "principal_collected": Decimal("0.00"),
        "interest_collected": Decimal("0.00"),
    } for p in points}

    for s in savings_rows:
        key = month_key(s.created_at)
        if key in index:
            if s.transaction_type == "withdrawal":
                index[key]["withdrawals"] += s.amount
            else:
                index[key]["deposits"] += s.amount
    for p in payment_rows:
        key = month_key(p.paid_at)
        if key in index:
            index[key]["principal_collected"] += p.principal_amount
            index[key]["interest_collected"] += p.interest_amount
    for l in loan_rows:
        key = month_key(l.approved_at)
        if key in index:
            index[key]["principal_disbursed"] += l.amount

    return [
        {k: (str(v) if isinstance(v, Decimal) else v) for k, v in index[p.strftime("%Y-%m")].items()}
        for p in points
    ]


@reports_router.get("/dashboard/period-deltas")
@limiter.limit("10/minute")
async def dashboard_period_deltas(
    request: Request,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required),
):
    """Percent change of key metrics: last 30 days vs the 30 days before."""
    now = utc_now()
    window_start = now - timedelta(days=30)
    prior_start = now - timedelta(days=60)

    def pct(current: Decimal, prior: Decimal) -> Optional[float]:
        if prior == 0:
            return None if current == 0 else 100.0
        return round(float((current - prior) / prior * 100), 1)

    # Savings deposits
    cur_sav = session.exec(
        select(func.sum(Savings.amount)).where(
            Savings.transaction_type == "deposit",
            col(Savings.created_at) >= window_start,
        )
    ).one() or Decimal("0.00")
    prior_sav = session.exec(
        select(func.sum(Savings.amount)).where(
            Savings.transaction_type == "deposit",
            col(Savings.created_at) >= prior_start,
            col(Savings.created_at) < window_start,
        )
    ).one() or Decimal("0.00")

    # Interest collected
    cur_int = session.exec(
        select(func.sum(Payments.interest_amount)).where(col(Payments.paid_at) >= window_start)
    ).one() or Decimal("0.00")
    prior_int = session.exec(
        select(func.sum(Payments.interest_amount)).where(
            col(Payments.paid_at) >= prior_start, col(Payments.paid_at) < window_start
        )
    ).one() or Decimal("0.00")

    # Loans issued (count)
    cur_loans = session.exec(
        select(func.count(Loan.id)).where(col(Loan.approved_at) >= window_start)
    ).one() or 0
    prior_loans = session.exec(
        select(func.count(Loan.id)).where(
            col(Loan.approved_at) >= prior_start, col(Loan.approved_at) < window_start
        )
    ).one() or 0

    # Principal collected
    cur_prin = session.exec(
        select(func.sum(Payments.principal_amount)).where(col(Payments.paid_at) >= window_start)
    ).one() or Decimal("0.00")
    prior_prin = session.exec(
        select(func.sum(Payments.principal_amount)).where(
            col(Payments.paid_at) >= prior_start, col(Payments.paid_at) < window_start
        )
    ).one() or Decimal("0.00")

    return {
        "window_days": 30,
        "savings_deposits_pct": pct(cur_sav, prior_sav),
        "interest_collected_pct": pct(cur_int, prior_int),
        "loans_issued_pct": pct(Decimal(cur_loans), Decimal(prior_loans)),
        "principal_collected_pct": pct(cur_prin, prior_prin),
    }
