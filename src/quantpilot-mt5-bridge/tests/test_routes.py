"""Route tests – no MT5 required (lazy import + TestClient)."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_blocks_execution():
    r = client.get("/")
    assert r.json()["execution"] == "BLOCKED"


def test_health_is_ui_contract_by_default():
    r = client.get("/api/v1/mt5/health")
    body = r.json()
    assert body["verification_tier"] == "UI_CONTRACT"
    assert body["execution"] == "BLOCKED"


def test_verification_backend_connected_without_mt5():
    # FastAPI is up (TestClient) but MT5 unavailable -> BACKEND_CONNECTED
    r = client.get("/api/v1/mt5/verification")
    body = r.json()
    assert body["bridge"] is True
    assert body["mt5"] is False
    assert body["tier"] == "BACKEND_CONNECTED"
    assert body["live_execution_blocked"] is True


def test_orders_execute_blocked():
    r = client.post("/api/v1/mt5/orders/execute", json={})
    body = r.json()
    assert body["execution"] == "BLOCKED"
    assert body["reason"] == "LIVE_EXECUTION_DISABLED"


def test_account_honest_when_mt5_unavailable():
    r = client.get("/api/v1/mt5/account")
    body = r.json()
    assert body["connected"] is False
    assert body["account"]["login"] == "********"


def test_symbol_not_found_returns_structured_error():
    r = client.get("/api/v1/mt5/symbols/XAUUSD")
    assert r.status_code >= 400
    body = r.json()
    assert body["ok"] is False
    assert "stage" in body and "error_code" in body