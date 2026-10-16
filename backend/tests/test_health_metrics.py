# tests/test_health_metrics.py
def test_health_reports_ok_with_database(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_metrics_exposes_request_series(client):
    client.get("/health")
    client.get("/some-unmatched-path")

    res = client.get("/metrics")
    assert res.status_code == 200
    assert "http_requests_total" in res.text
    assert "http_request_duration_seconds" in res.text

    assert 'handler="/health"' not in res.text
    assert 'handler="/metrics"' not in res.text
