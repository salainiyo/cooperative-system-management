# tests/test_savings.py
from decimal import Decimal


def test_deposit_updates_balance_and_member_total(client, auth_headers, member_id):
    first = client.post(
        f"/savings/{member_id}", json={"amount": "5000"}, headers=auth_headers
    )
    assert first.status_code == 201, first.text
    assert float(first.json()["balance_after"]) == 5000.0
    assert first.json()["transaction_type"] == "deposit"

    second = client.post(
        f"/savings/{member_id}", json={"amount": "2500"}, headers=auth_headers
    )
    assert float(second.json()["balance_after"]) == 7500.0

    detail = client.get(f"/member/{member_id}", headers=auth_headers)
    assert float(detail.json()["total_savings"]) == 7500.0


def test_withdrawal_reduces_balance(client, auth_headers, member_id):
    client.post(f"/savings/{member_id}", json={"amount": "5000"}, headers=auth_headers)
    withdrawal = client.post(
        f"/savings/{member_id}",
        json={"amount": "1500", "transaction_type": "withdrawal"},
        headers=auth_headers,
    )
    assert withdrawal.status_code == 201, withdrawal.text
    body = withdrawal.json()
    assert body["transaction_type"] == "withdrawal"
    assert float(body["balance_after"]) == 3500.0

    detail = client.get(f"/member/{member_id}", headers=auth_headers)
    assert float(detail.json()["total_savings"]) == 3500.0

    savings = client.get(f"/savings/{member_id}", headers=auth_headers)
    assert len(savings.json()) == 2


def test_withdrawal_guards(client, auth_headers, member_id):
    # Nothing to withdraw
    empty = client.post(
        f"/savings/{member_id}",
        json={"amount": "100", "transaction_type": "withdrawal"},
        headers=auth_headers,
    )
    assert empty.status_code == 400

    client.post(f"/savings/{member_id}", json={"amount": "1000"}, headers=auth_headers)

    # More than the balance
    too_much = client.post(
        f"/savings/{member_id}",
        json={"amount": "1000.01", "transaction_type": "withdrawal"},
        headers=auth_headers,
    )
    assert too_much.status_code == 400
    assert "exceeds" in too_much.json()["detail"].lower()


def test_invalid_savings_payloads_rejected(client, auth_headers, member_id):
    zero = client.post(f"/savings/{member_id}", json={"amount": "0"}, headers=auth_headers)
    assert zero.status_code == 422

    negative = client.post(f"/savings/{member_id}", json={"amount": "-5"}, headers=auth_headers)
    assert negative.status_code == 422

    bad_type = client.post(
        f"/savings/{member_id}",
        json={"amount": "100", "transaction_type": "transfer"},
        headers=auth_headers,
    )
    assert bad_type.status_code == 422

    missing_member = client.post("/savings/99999", json={"amount": "100"}, headers=auth_headers)
    assert missing_member.status_code == 404


def test_savings_history_recalculates_after_edit_and_delete(client, auth_headers, member_id):
    a = client.post(f"/savings/{member_id}", json={"amount": "1000"}, headers=auth_headers).json()
    b = client.post(f"/savings/{member_id}", json={"amount": "2000"}, headers=auth_headers).json()
    client.post(f"/savings/{member_id}", json={"amount": "500"}, headers=auth_headers).json()

    # Edit the middle entry
    updated = client.patch(
        f"/savings/{b['id']}", json={"amount": "3000"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert float(updated.json()["balance_after"]) == 4000.0  # 1000 + 3000 + 500

    # Delete the first entry → everything shifts
    deleted = client.delete(f"/savings/{a['id']}", headers=auth_headers)
    assert deleted.status_code == 200

    history = client.get(f"/savings/{member_id}", headers=auth_headers).json()
    by_id = {row["id"]: row for row in history}
    assert float(by_id[b["id"]]["balance_after"]) == 3000.0  # 3000 + 500

    detail = client.get(f"/member/{member_id}", headers=auth_headers)
    assert float(detail.json()["total_savings"]) == 3500.0


def test_dashboard_stats_net_of_withdrawals(client, auth_headers, member_id):
    client.post(f"/savings/{member_id}", json={"amount": "5000"}, headers=auth_headers)
    client.post(
        f"/savings/{member_id}",
        json={"amount": "2000", "transaction_type": "withdrawal"},
        headers=auth_headers,
    )

    stats = client.get("/admin/dashboard-stats", headers=auth_headers)
    assert stats.status_code == 200
    assert Decimal(str(stats.json()["total_savings"])) == Decimal("3000")
