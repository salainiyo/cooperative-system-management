# tests/test_portal.py


def _create_portal_member(client, auth_headers, member_id, email="portal@coop.rw"):
    res = client.post(
        "/admin/member-accounts",
        json={"member_id": member_id, "email": email},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    login = client.post(
        "/auth/login",
        data={"username": email, "password": body["temporary_password"]},
    )
    assert login.status_code == 200, login.text
    tokens = login.json()
    return {
        "email": email,
        "password": body["temporary_password"],
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }


def test_admin_cannot_use_portal(client, auth_headers):
    res = client.get("/portal/account", headers=auth_headers)
    assert res.status_code == 403
    assert "do not have a member portal" in res.json()["detail"]


def test_member_cannot_use_admin_endpoints(client, auth_headers, member_id):
    member = _create_portal_member(client, auth_headers, member_id)
    for path in ("/admin/settings/", "/admin/users", "/admin/loan-requests", "/admin/dashboard-stats"):
        res = client.get(path, headers=member["headers"])
        assert res.status_code == 403, f"{path} should be admin-only"


def test_portal_requires_linked_member(client, auth_headers):
    # A user with no linked member record gets a clear 403.
    res = client.post(
        "/auth/register",
        json={"email": "orphan@coop.rw", "password": "password123"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    login = client.post(
        "/auth/login", data={"username": "orphan@coop.rw", "password": "password123"}
    ).json()
    res = client.get(
        "/portal/account", headers={"Authorization": f"Bearer {login['access_token']}"}
    )
    assert res.status_code == 403


def test_portal_account_and_history(client, auth_headers, member_id):
    member = _create_portal_member(client, auth_headers, member_id)
    client.post(f"/savings/{member_id}", json={"amount": "4000"}, headers=auth_headers)

    account = client.get("/portal/account", headers=member["headers"])
    assert account.status_code == 200
    body = account.json()
    assert body["member_id"] == member_id
    assert body["email"] == "portal@coop.rw"
    assert float(body["total_savings"]) == 4000.0

    savings = client.get("/portal/savings", headers=member["headers"])
    assert savings.status_code == 200
    assert len(savings.json()) == 1
    assert float(savings.json()[0]["amount"]) == 4000.0

    loans = client.get("/portal/loans", headers=member["headers"])
    assert loans.status_code == 200
    assert loans.json() == {"active_loans": [], "completed_loans": []}


def test_loan_eligibility_gate(client, auth_headers, member_id):
    member = _create_portal_member(client, auth_headers, member_id)

    # No savings yet → cannot request
    res = client.get("/portal/loan-eligibility", headers=member["headers"])
    assert res.status_code == 200
    assert res.json()["can_request"] is False
    assert "savings" in res.json()["reason"].lower()

    blocked = client.post(
        "/portal/loan-requests",
        json={"amount": "1000", "monthly_payment": "100"},
        headers=member["headers"],
    )
    assert blocked.status_code == 400

    # With savings → eligible up to 2x
    client.post(f"/savings/{member_id}", json={"amount": "4000"}, headers=auth_headers)
    res = client.get("/portal/loan-eligibility", headers=member["headers"])
    body = res.json()
    assert body["can_request"] is True
    assert float(body["max_loan_allowed"]) == 8000.0
    assert float(body["interest_rate"]) == 0.015
    assert float(body["loan_savings_multiplier"]) == 2.0

    over_limit = client.post(
        "/portal/loan-requests",
        json={"amount": "8000.01", "monthly_payment": "100"},
        headers=member["headers"],
    )
    assert over_limit.status_code == 400

    ok = client.post(
        "/portal/loan-requests",
        json={"amount": "5000", "monthly_payment": "250", "purpose": "School fees"},
        headers=member["headers"],
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["status"] == "pending"
    assert ok.json()["member_name"] == "Test Member"

    # Only one pending request at a time
    duplicate = client.post(
        "/portal/loan-requests",
        json={"amount": "1000", "monthly_payment": "100"},
        headers=member["headers"],
    )
    assert duplicate.status_code == 409

    mine = client.get("/portal/loan-requests", headers=member["headers"])
    assert mine.status_code == 200
    assert len(mine.json()) == 1


def test_loan_request_approval_creates_loan(client, auth_headers, member_id, outbox, smtp_configured):
    member = _create_portal_member(client, auth_headers, member_id)
    client.post(f"/savings/{member_id}", json={"amount": "4000"}, headers=auth_headers)
    created = client.post(
        "/portal/loan-requests",
        json={"amount": "5000", "monthly_payment": "250"},
        headers=member["headers"],
    ).json()

    queue = client.get("/admin/loan-requests", headers=auth_headers)
    assert queue.status_code == 200
    assert any(r["id"] == created["id"] for r in queue.json())

    approved = client.post(
        f"/admin/loan-requests/{created['id']}/approve",
        json={"note": "Approved at the office"},
        headers=auth_headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["loan_id"]

    # A loan now exists and the member sees it
    detail = client.get(f"/member/{member_id}", headers=auth_headers)
    assert len(detail.json()["active_loans"]) == 1

    loans = client.get("/portal/loans", headers=member["headers"])
    assert len(loans.json()["active_loans"]) == 1

    # Member was emailed the decision
    assert any(m["to"] == "portal@coop.rw" for m in outbox)

    # Decided requests cannot be decided twice
    again = client.post(
        f"/admin/loan-requests/{created['id']}/approve", json={}, headers=auth_headers
    )
    assert again.status_code == 409

    # Active loan blocks new requests
    blocked = client.get("/portal/loan-eligibility", headers=member["headers"])
    assert blocked.json()["can_request"] is False
    assert "active loan" in blocked.json()["reason"].lower()


def test_loan_request_rejection(client, auth_headers, member_id):
    member = _create_portal_member(client, auth_headers, member_id)
    client.post(f"/savings/{member_id}", json={"amount": "4000"}, headers=auth_headers)
    created = client.post(
        "/portal/loan-requests",
        json={"amount": "5000", "monthly_payment": "250"},
        headers=member["headers"],
    ).json()

    rejected = client.post(
        f"/admin/loan-requests/{created['id']}/reject",
        json={"note": "Savings too low for this amount"},
        headers=auth_headers,
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    # No loan was created
    detail = client.get(f"/member/{member_id}", headers=auth_headers)
    assert detail.json()["active_loans"] == []

    # Member can submit a new request after the rejection
    retry = client.post(
        "/portal/loan-requests",
        json={"amount": "3000", "monthly_payment": "150"},
        headers=member["headers"],
    )
    assert retry.status_code == 201


def test_portal_account_lifecycle(client, auth_headers, member_id, outbox, smtp_configured):
    created = client.post(
        "/admin/member-accounts",
        json={"member_id": member_id, "email": "portal@coop.rw"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    temp_password = created.json()["temporary_password"]
    assert len(temp_password) == 10

    # Credentials email was delivered
    assert any(m["to"] == "portal@coop.rw" for m in outbox)

    users = client.get("/admin/users", headers=auth_headers)
    assert users.status_code == 200
    entry = next(u for u in users.json()["users"] if u["email"] == "portal@coop.rw")
    assert entry["member_id"] == member_id
    assert entry["member_name"] == "Test Member"

    # Reset credentials → old password stops working
    reset = client.post(
        "/admin/member-accounts",
        json={"member_id": member_id, "email": "portal@coop.rw"},
        headers=auth_headers,
    )
    assert reset.status_code == 201
    assert reset.json()["temporary_password"] != temp_password
    assert (
        client.post(
            "/auth/login", data={"username": "portal@coop.rw", "password": temp_password}
        ).status_code
        != 200
    )
    assert client.post(
        "/auth/login",
        data={"username": "portal@coop.rw", "password": reset.json()["temporary_password"]},
    ).status_code == 200

    # Remove portal access entirely
    removed = client.delete(f"/admin/member-accounts/{member_id}", headers=auth_headers)
    assert removed.status_code == 200
    assert client.post(
        "/auth/login",
        data={"username": "portal@coop.rw", "password": reset.json()["temporary_password"]},
    ).status_code == 401
