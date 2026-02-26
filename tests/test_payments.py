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
    }
    response = client.post("/member/", json=member_data, headers=headers)
    assert response.status_code == 201, f"Failed to create member: {response.text}"
    member_id = response.json()["id"]
    
    # --- STEP 2: ADD SAVINGS ---
    savings_data = {
        "amount": 500,
    }
    # FIXED: Added the 'f' prefix to the route string
    response = client.post(f"/savings/{member_id}", json=savings_data, headers=headers)
    assert response.status_code == 201, f"Failed to create savings: {response.text}"
    
    # --- STEP 3: ISSUE LOAN ---
    loan_data = {
        "amount": "1000.00",
        "interest_rate": 1.5,  # Added to satisfy the backend schema requirements
        "monthly_payment": "100.00",
    }
    response = client.post(f"/loan/{member_id}", json=loan_data, headers=headers)
    assert response.status_code == 201, f"Failed to create loan: {response.text}"
    loan_id = response.json()["id"]

    # --- STEP 4: MAKE A PAYMENT ---
    payment_data = {"amount": "100.00"}
    response = client.post(f"/payment/{loan_id}", json=payment_data, headers=headers)

    assert response.status_code == 201, f"Failed to create payment: {response.text}"
    data = response.json()

    # Verify the waterfall calculation worked! (1.5% of 1000 = 15)
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
        },
        headers=headers,
    )
    assert response.status_code == 201, f"Failed to create member: {response.text}"
    member_id = response.json()["id"]   
    
    # 2. Create Savings
    savings_data = {
        "amount": 100
    }
    # FIXED: Added the 'f' prefix to the route string
    response = client.post(f"/savings/{member_id}", json=savings_data, headers=headers)
    assert response.status_code == 201, f"Failed to create savings: {response.text}"

    # 3. Create Loan (Max allowed is 200.00 because savings is 100)
    response = client.post(
        f"/loan/{member_id}",
        json={
            "amount": "200.00",
            "interest_rate": 1.5, # Added to satisfy schema
            "monthly_payment": "50.00",
        },
        headers=headers,
    )
    assert response.status_code == 201, f"Failed to create loan: {response.text}"
    loan_id = response.json()["id"]

    # 4. Try to pay 300.00 (Should fail because 200 loan + 3 interest = 203 to clear)
    response = client.post(
        f"/payment/{loan_id}", json={"amount": "300.00"}, headers=headers
    )

    # 5. Verify the backend successfully blocked the overpayment
    assert response.status_code == 422
    assert "Overpayment" in response.json()["detail"]
    
# Add this to the bottom of test_payments.py

def test_update_payment_recalculates_correctly(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a Member
    member_response = client.post(
        "/member/",
        json={
            "first_name": "Update",
            "last_name": "Test",
            "date_of_birth": "1985-05-05",
            "gender": "Female",
            "phone_number": "0785555555",
        },
        headers=headers,
    )
    member_id = member_response.json()["id"]

    # 2. Add Savings
    client.post(f"/savings/{member_id}", json={"amount": 1000}, headers=headers)

    # 3. Issue a Loan
    loan_response = client.post(
        f"/loan/{member_id}",
        json={
            "amount": "500.00",
            "interest_rate": 1.5,
            "monthly_payment": "100.00",
        },
        headers=headers,
    )
    loan_id = loan_response.json()["id"]

    # 4. Make an Initial Payment of 50.00 RWF
    initial_payment = client.post(
        f"/payment/{loan_id}", 
        json={"amount": "50.00"}, 
        headers=headers
    )
    assert initial_payment.status_code == 201
    payment_id = initial_payment.json()["id"]

    # 5. UPDATE the payment to 100.00 RWF
    update_response = client.patch(
        f"/payment/{payment_id}", 
        json={"amount": "100.00"}, 
        headers=headers
    )
    
    # 6. Verify the update succeeded
    assert update_response.status_code == 200, f"Update failed: {update_response.text}"
    updated_data = update_response.json()
    
    # Ensure the new total amount is registered
    assert float(updated_data["total_amount"]) == 100.00
    
    # The interest on a 500 loan at 1.5% is 7.5
    # If the payment is 100, principal should be 92.5
    assert float(updated_data["interest_amount"]) == 7.50
    assert float(updated_data["principal_amount"]) == 92.50
    

def test_update_payment_overpayment_protection(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a Member
    member_response = client.post(
        "/member/",
        json={
            "first_name": "Update",
            "last_name": "Overpayer",
            "date_of_birth": "1990-01-01",
            "gender": "Male",
            "phone_number": "0784444444",
        },
        headers=headers,
    )
    assert member_response.status_code == 201
    member_id = member_response.json()["id"]

    # 2. Add Savings
    client.post(f"/savings/{member_id}", json={"amount": 1000}, headers=headers)

    # 3. Issue a Loan (Amount: 200, Interest: 1.5% -> 3)
    loan_response = client.post(
        f"/loan/{member_id}",
        json={
            "amount": "200.00",
            "interest_rate": 1.5,
            "monthly_payment": "50.00",
        },
        headers=headers,
    )
    assert loan_response.status_code == 201
    loan_id = loan_response.json()["id"]

    # 4. Make an Initial Valid Payment of 50.00 RWF
    initial_payment = client.post(
        f"/payment/{loan_id}", 
        json={"amount": "50.00"}, 
        headers=headers
    )
    assert initial_payment.status_code == 201
    payment_id = initial_payment.json()["id"]

    # 5. Try to UPDATE the payment to 300.00 RWF (Exceeds the ~203 total clearance)
    update_response = client.patch(
        f"/payment/{payment_id}", 
        json={"amount": "300.00"}, 
        headers=headers
    )
    
    # 6. Verify the backend correctly identifies and blocks the overpayment
    assert update_response.status_code in [400, 422], f"Expected failure, got {update_response.status_code}"
    
    # Check that the error message explicitly mentions the overpayment
    error_detail = update_response.json().get("detail", "").lower()
    assert "overpayment" in error_detail or "exceeds" in error_detail