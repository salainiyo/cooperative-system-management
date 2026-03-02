# tests/test_loans.py
from datetime import timedelta
from sqlmodel import select
from models.models import Loan

def test_loan_crud_lifecycle(client, admin_token):
    """Tests the full Create, Read (implied), Update, and Delete cycle for a Loan."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. SETUP: Create Member & Savings
    member_res = client.post(
        "/member/",
        json={"first_name": "Crud", "last_name": "Master", "date_of_birth": "1990-01-01", "gender": "Male", "phone_number": "0788888888"},
        headers=headers,
    )
    member_id = member_res.json()["id"]
    client.post(f"/savings/{member_id}", json={"amount": 5000}, headers=headers)

    # 2. CREATE (POST)
    loan_res = client.post(
        f"/loan/{member_id}",
        json={"amount": "1000.00", "monthly_payment": "100.00"},
        headers=headers,
    )
    assert loan_res.status_code == 201
    loan_id = loan_res.json()["id"]
    assert float(loan_res.json()["amount"]) == 1000.00

    # 3. UPDATE (PATCH) - Let's increase the monthly payment
    update_res = client.patch(
        f"/loan/{loan_id}",
        json={"amount": "1000.00", "monthly_payment": "200.00"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert float(update_res.json()["monthly_payment"]) == 200.00

    # 4. DELETE (DELETE)
    delete_res = client.delete(f"/loan/{loan_id}", headers=headers)
    assert delete_res.status_code == 200
    assert float(delete_res.json()["amount"]) == 1000.00

    # Verify it is actually gone from the member's profile
    member_check = client.get(f"/member/{member_id}", headers=headers)
    assert len(member_check.json()["active_loans"]) == 0


def test_accumulated_late_fees_calculation(client, admin_token, session):
    """Simulates time travel to test the 3% monthly penalty logic."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. SETUP: Create Member & Savings
    member_res = client.post(
        "/member/",
        json={"first_name": "Late", "last_name": "Payer", "date_of_birth": "1995-05-05", "gender": "Female", "phone_number": "0789999999"},
        headers=headers,
    )
    member_id = member_res.json()["id"]
    client.post(f"/savings/{member_id}", json={"amount": 20000}, headers=headers)

    # 2. CREATE: Issue a standard loan
    # Monthly Payment: 1000. Penalty should be 3% of 1000 = 30 RWF per month late.
    loan_res = client.post(
        f"/loan/{member_id}",
        json={"amount": "10000.00", "monthly_payment": "1000.00"},
        headers=headers,
    )
    loan_id = loan_res.json()["id"]

    # 3. TIME TRAVEL (Direct Database Manipulation)
    # We grab the physical loan from the test database and push its approval date exactly 65 days into the past.
    db_loan = session.get(Loan, loan_id)
    db_loan.approved_at = db_loan.approved_at - timedelta(days=65)
    
    # Save our "hacked" time to the database
    session.add(db_loan)
    session.commit()

    # 4. VERIFY: Fetch the member profile and check the dynamic @property calculation
    profile_res = client.get(f"/member/{member_id}", headers=headers)
    assert profile_res.status_code == 200
    
    active_loans = profile_res.json()["active_loans"]
    assert len(active_loans) == 1
    
    # Mathematical Breakdown:
    # - Approved 65 days ago (approx 2 months).
    # - The first payment was due 30 days ago (1 month late).
    # - The second payment is due in about 5 days (but hasn't crossed the threshold yet).
    # - Expectation: 1 month late * 3% * 1000 monthly payment = 30 RWF late fee.
    late_fees = float(active_loans[0]["accumulated_late_fees"])
    
    assert late_fees > 0, "Late fees did not trigger!"
    assert late_fees == 60.00, f"Expected 60.00, but got {late_fees}"