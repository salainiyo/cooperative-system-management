def test_delete_member_with_savings_fails(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a member
    member_response = client.post(
        "/member/",
        json={
            "first_name": "Rich",
            "last_name": "Uncle",
            "date_of_birth": "1980-05-05",
            "gender": "Male",
            "phone_number": "0781111111",
        },
        headers=headers,
    )
    member_id = member_response.json()["id"]

    # 2. Add some savings
    client.post(
        f"/savings/{member_id}", 
        json={"amount": 5000}, 
        headers=headers
    )

    # 3. Attempt to delete the member
    delete_response = client.delete(f"/member/{member_id}", headers=headers)

    # 4. Verify the backend blocked it (Usually throws a 400 Bad Request)
    assert delete_response.status_code == 400
    assert "savings" in delete_response.json()["detail"].lower()


def test_delete_member_with_active_loan_fails(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a member
    member_response = client.post(
        "/member/",
        json={
            "first_name": "Borrower",
            "last_name": "Bob",
            "date_of_birth": "1992-02-02",
            "gender": "Male",
            "phone_number": "0782222222",
        },
        headers=headers,
    )
    member_id = member_response.json()["id"]

    # 2. Add savings (required to get a loan)
    client.post(f"/savings/{member_id}", json={"amount": 2000}, headers=headers)

    # 3. Issue a loan
    client.post(
        f"/loan/{member_id}",
        json={"amount": "1000", "interest_rate": 1.5, "monthly_payment": "100"},
        headers=headers,
    )

    # 4. Attempt to delete the member
    delete_response = client.delete(f"/member/{member_id}", headers=headers)

    # 5. Verify the backend blocked it
    assert delete_response.status_code == 400
    assert "loan" in delete_response.json()["detail"].lower()


def test_delete_clean_member_succeeds(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a member
    member_response = client.post(
        "/member/",
        json={
            "first_name": "Clean",
            "last_name": "Slate",
            "date_of_birth": "2000-10-10",
            "gender": "Female",
            "phone_number": "0783333333",
        },
        headers=headers,
    )
    member_id = member_response.json()["id"]

    # 2. Attempt to delete immediately (No savings, No loans)
    delete_response = client.delete(f"/member/{member_id}", headers=headers)

    # 3. Verify it succeeded (204 No Content or 200 OK depending on your FastAPI return type)
    assert delete_response.status_code in [200, 204]

    # 4. Verify they are actually gone
    get_response = client.get(f"/member/{member_id}", headers=headers)
    assert get_response.status_code == 404