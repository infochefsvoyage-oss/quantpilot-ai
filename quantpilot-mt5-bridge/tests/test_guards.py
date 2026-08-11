"""Unit tests for guards (no MT5 terminal required)."""
import time
from app.config import settings
from app import guards


def test_heartbeat_stale_when_no_record():
    assert guards.heartbeat_state() == "STALE"


def test_heartbeat_healthy_then_warning(monkeypatch):
    guards.record_heartbeat()
    assert guards.heartbeat_state() == "HEALTHY"
    # simulate age > healthy but <= stale
    monkeypatch.setattr(guards.time, "time", lambda: guards._last_heartbeat + settings.heartbeat_healthy_seconds + 1)
    assert guards.heartbeat_state() == "WARNING"
    assert guards.execution_allowed_by_heartbeat() is False  # WARNING blocks


def test_execution_guard_blocks_when_anything_missing():
    ok, reasons = guards.execution_guard(
        connected=True, risk_approved=False, governance_approved=True,
        emergency_stop=False, duplicate=False, order_valid=True,
    )
    assert ok is False
    assert "RISK_NOT_APPROVED" in reasons


def test_execution_guard_blocks_live_by_default():
    ok, reasons = guards.execution_guard(
        connected=True, risk_approved=True, governance_approved=True,
        emergency_stop=False, duplicate=False, order_valid=True,
    )
    # live_execution defaults false -> blocked
    assert ok is False
    assert "LIVE_EXECUTION_DISABLED" in reasons


def test_duplicate_detected():
    pos = [{"symbol": "XAUUSD", "type": 0, "magic": 777077}]  # BUY
    assert guards.duplicate_detected("XAUUSD", "BUY", 777077, pos, []) is True
    assert guards.duplicate_detected("XAUUSD", "SELL", 777077, pos, []) is False