# tests/test_reports.py
import csv
import io


def _setup_member_with_loan(client, auth_headers, member_id, amount="4000", loan="2000", monthly="200"):
    client.post(f"/savings/{member_id}", json={"amount": amount}, headers=auth_headers)
    res = client.post(
        f"/loan/{member_id}",
        json={"amount": loan, "monthly_payment": monthly},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _csv_rows(text):
    return list(csv.reader(io.StringIO(text)))


def test_reports_require_admin(client):
    for path in (
        "/admin/reports/collections",
        "/admin/reports/portfolio",
        "/admin/dashboard/timeseries",
        "/admin/dashboard/period-deltas",
        "/admin/export/members.csv",
    ):
        assert client.get(path).status_code == 401, path


def test_collections_report(client, auth_headers, member_id):
    _setup_member_with_loan(client, auth_headers, member_id)

    res = client.get("/admin/reports/collections", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "active_loans"
    assert len(body["loans"]) == 1
    loan = body["loans"][0]
    assert loan["member_name"] == "Test Member"
    assert loan["phone_number"] == "0789000001"
    assert float(loan["amount"]) == 2000.0
    assert float(loan["remaining_balance"]) == 2000.0
    assert "monthly_payment" in loan and "accumulated_late_fees" in loan
    assert "next_due_date" in loan


def test_portfolio_report_buckets(client, auth_headers, member_id):
    _setup_member_with_loan(client, auth_headers, member_id)

    res = client.get("/admin/reports/portfolio", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert float(body["total_active_principal"]) == 2000.0
    assert float(body["par_ratio"]) == 0.0
    assert set(body["buckets"]) == {"current", "1-30", "31-60", "61-90", "90+"}
    assert body["buckets"]["current"]["count"] == 1
    assert body["buckets"]["current"]["loans"][0]["member_name"] == "Test Member"


def test_dashboard_timeseries_and_deltas(client, auth_headers, member_id):
    _setup_member_with_loan(client, auth_headers, member_id)

    series = client.get("/admin/dashboard/timeseries?months=3", headers=auth_headers)
    assert series.status_code == 200
    points = series.json()
    assert len(points) == 3
    assert set(points[0]) == {
        "month",
        "deposits",
        "withdrawals",
        "principal_disbursed",
        "principal_collected",
        "interest_collected",
    }
    # The loan + savings we just created land in the current month bucket.
    assert sum(float(p["deposits"]) for p in points) == 4000.0
    assert sum(float(p["principal_disbursed"]) for p in points) == 2000.0

    deltas = client.get("/admin/dashboard/period-deltas", headers=auth_headers)
    assert deltas.status_code == 200
    body = deltas.json()
    assert body["window_days"] == 30
    for key in ("savings_deposits_pct", "interest_collected_pct", "loans_issued_pct", "principal_collected_pct"):
        assert key in body, f"missing {key}"
    # Everything was created in the current window → the trend must be reported.
    assert body["savings_deposits_pct"] == 100.0


def test_member_statement(client, auth_headers, member_id):
    loan_id = _setup_member_with_loan(client, auth_headers, member_id)
    payment = client.post(
        f"/payment/{loan_id}", json={"amount": "300"}, headers=auth_headers
    )
    assert payment.status_code in (200, 201), payment.text
    client.post(
        f"/savings/{member_id}",
        json={"amount": "500", "transaction_type": "withdrawal"},
        headers=auth_headers,
    )

    res = client.get(f"/admin/members/{member_id}/statement", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["member"]["name"] == "Test Member"
    assert len(body["savings"]) == 2
    assert len(body["payments"]) == 1
    assert float(body["summary"]["total_deposits"]) == 4000.0
    assert float(body["summary"]["total_withdrawals"]) == 500.0
    assert float(body["summary"]["total_loan_payments"]) > 0
    assert float(body["summary"]["current_savings_balance"]) == 3500.0

    # Date filtering
    empty = client.get(
        f"/admin/members/{member_id}/statement?from=2000-01-01&to=2000-01-31",
        headers=auth_headers,
    )
    assert empty.status_code == 200
    assert empty.json()["savings"] == []
    assert empty.json()["payments"] == []


def test_csv_exports(client, auth_headers, member_id):
    loan_id = _setup_member_with_loan(client, auth_headers, member_id)
    client.post(f"/payment/{loan_id}", json={"amount": "300"}, headers=auth_headers)

    expected_headers = {
        "members": ["first_name", "last_name"],
        "savings": ["member_id", "type"],
        "loans": ["member_id", "monthly_payment"],
        "payments": ["loan_id", "principal"],
    }

    for dataset, needles in expected_headers.items():
        res = client.get(f"/admin/export/{dataset}.csv", headers=auth_headers)
        assert res.status_code == 200, dataset
        assert "text/csv" in res.headers["content-type"], dataset
        rows = _csv_rows(res.text)
        header = ",".join(rows[0])
        for needle in needles:
            assert needle in header, f"{dataset}: missing column {needle}"
        assert len(rows) >= 2, f"{dataset}: expected data rows"

    unknown = client.get("/admin/export/bogus.csv", headers=auth_headers)
    assert unknown.status_code == 404


def test_loan_list_and_detail_endpoints(client, auth_headers, member_id):
    loan_id = _setup_member_with_loan(client, auth_headers, member_id)

    listing = client.get("/loan/", headers=auth_headers)
    assert listing.status_code == 200
    body = listing.json()
    assert body["total_count"] == 1
    loan = body["loans"][0]
    assert loan["id"] == loan_id
    assert loan["member_name"] == "Test Member"

    filtered = client.get("/loan/?status=paid", headers=auth_headers)
    assert filtered.json()["total_count"] == 0

    detail = client.get(f"/loan/{loan_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert float(detail.json()["amount"]) == 2000.0

    payments = client.get(f"/loan/{loan_id}/payments", headers=auth_headers)
    assert payments.status_code == 200
    assert payments.json()["payments"] == []

    assert client.get("/loan/99999", headers=auth_headers).status_code == 404
