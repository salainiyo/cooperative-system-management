# test_payments.py


def test_full_loan_lifecycle(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # --- STEP 1: REGISTER MEMBER ---
    member_data = {
        "first_name": "John",
        "last_name": "Doe",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
        "phone_number": "+123456789",
        "savings": "500.00",
    }
    # Changed to /member/
    response = client.post("/member/", json=member_data, headers=headers)
    assert response.status_code == 201, f"Failed to create member: {response.text}"
    member_id = response.json()["id"]

    # --- STEP 2: ISSUE LOAN ---
    loan_data = {
        "amount": "1000.00",
        "payable_at": "2024-12-31",
        "monthly_payment": "100.00",
    }
    # Changed to /loan/
    response = client.post(f"/loan/{member_id}", json=loan_data, headers=headers)
    assert response.status_code == 201, f"Failed to create loan: {response.text}"
    loan_id = response.json()["id"]

    # --- STEP 3: MAKE A PAYMENT ---
    payment_data = {"amount": "100.00"}
    # Changed to /payment/
    response = client.post(f"/payment/{loan_id}", json=payment_data, headers=headers)

    assert response.status_code == 201, f"Failed to create payment: {response.text}"
    data = response.json()

    assert data["interest_amount"] == "15.00"
    assert data["principal_amount"] == "85.00"
    assert data["total_amount"] == "100.00"


def test_loan_overpayment_protection(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Member
    response = client.post(
        "/member/",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "date_of_birth": "1990-01-01",
            "gender": "Female",
            "phone_number": "987654321",
            "savings": "100.00",
        },
        headers=headers,
    )
    assert response.status_code == 201
    member_id = response.json()["id"]

    # 2. Create Loan (200.00)
    response = client.post(
        f"/loan/{member_id}",
        json={
            "amount": "200.00",
            "payable_at": "2024-12-31",
            "monthly_payment": "50.00",
        },
        headers=headers,
    )
    assert response.status_code == 201
    loan_id = response.json()["id"]

    # 3. Try to pay 300.00 (Should fail because 200 loan + 3 interest = 203)
    response = client.post(
        f"/payment/{loan_id}", json={"amount": "300.00"}, headers=headers
    )

    assert response.status_code == 422
    assert "Overpayment" in response.json()["detail"]
