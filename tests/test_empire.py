from __future__ import annotations

from fastapi.testclient import TestClient


def test_purchase_ingest_and_agent_flow(client: TestClient) -> None:
    content = """Vendor: Stellar Supplies\nTotal: 15000\nDue: 2023-09-01\nItem: Satellite Antenna\nDescription: Communication upgrade\n"""
    response = client.post(
        "/ingest/purchase",
        data={"llc_name": "Orbital LLC"},
        files={"file": ("invoice.txt", content, "text/plain")},
    )
    assert response.status_code == 200
    payload = response.json()

    purchase_order = payload["purchase_order"]
    assert purchase_order["total_amount"] == 15000
    assert purchase_order["vendor"]["name"] == "Stellar Supplies"

    suggestions = payload["suggestions"]
    assert any(s["suggestion_type"] == "create-repayment-plan" for s in suggestions)

    events_response = client.get("/events")
    assert events_response.status_code == 200
    events = events_response.json()
    event_types = {event["event_type"] for event in events}
    assert {"ingest.received", "ingest.parsed", "purchase_order.created"}.issubset(event_types)

    search_response = client.get("/search/documents", params={"query": "Satellite"})
    assert search_response.status_code == 200
    search_results = search_response.json()
    assert search_results
    assert search_results[0]["score"] > 0

    overdue_content = """Vendor: Stellar Supplies\nTotal: 500\nDue: 2020-01-01\nDescription: Late invoice\n"""
    response_overdue = client.post(
        "/ingest/purchase",
        data={"llc_name": "Orbital LLC"},
        files={"file": ("invoice2.txt", overdue_content, "text/plain")},
    )
    assert response_overdue.status_code == 200
    overdue_payload = response_overdue.json()
    overdue_suggestions = overdue_payload["suggestions"]
    flag = next((s for s in overdue_suggestions if s["suggestion_type"] == "flag-overdue"), None)
    assert flag is not None

    approve_response = client.post(f"/agents/suggestions/{flag['id']}/approve")
    assert approve_response.status_code == 200
    approval_payload = approve_response.json()
    assert approval_payload["suggestion"]["approved"] is True
    assert approval_payload["event"]["event_type"] == "agent_suggestion.approved"
