"""Execution Guard, Heartbeat & Duplicate Guard (sections 8, 9, 11)."""
from __future__ import annotations
import time
from typing import Optional
from .config import settings
from .schemas import BridgeError


_last_heartbeat: Optional[float] = None
_last_heartbeat_payload: Optional[dict] = None


def record_heartbeat(payload: Optional[dict] = None) -> None:
    global _last_heartbeat, _last_heartbeat_payload
    _last_heartbeat = time.time()
    _last_heartbeat_payload = payload


def heartbeat_state(now: Optional[float] = None) -> str:
    """< healthy_sec → HEALTHY; <= stale_sec → WARNING; > stale_sec → STALE."""
    if _last_heartbeat is None:
        return "STALE"
    now = now or time.time()
    age = now - _last_heartbeat
    if age < settings.heartbeat_healthy_seconds:
        return "HEALTHY"
    if age <= settings.heartbeat_stale_seconds:
        return "WARNING"
    return "STALE"


def heartbeat_reason() -> str:
    """Distinguish WHY the heartbeat is not HEALTHY.
    EA_NOT_RUNNING         – no EA ever posted (last_heartbeat is None)
    EA_HEARTBEAT_NOT_RECEIVED – bridge up but endpoint never called (alias for EA_NOT_RUNNING)
    HEARTBEAT_STALE         – EA posted before but timed out (> stale_sec)
    HEARTBEAT_HEALTHY       – within healthy window
    """
    if _last_heartbeat is None:
        return "EA_NOT_RUNNING"
    age = time.time() - _last_heartbeat
    if age < settings.heartbeat_healthy_seconds:
        return "HEARTBEAT_HEALTHY"
    if age <= settings.heartbeat_stale_seconds:
        return "HEARTBEAT_STALE"
    return "HEARTBEAT_STALE"


def heartbeat_age_seconds(now: Optional[float] = None) -> Optional[float]:
    if _last_heartbeat is None:
        return None
    return (now or time.time()) - _last_heartbeat


def last_heartbeat_payload() -> Optional[dict]:
    return _last_heartbeat_payload


def execution_allowed_by_heartbeat() -> bool:
    """Safety correction (section 5): only HEALTHY allows execution – WARNING blocks too."""
    return heartbeat_state() == "HEALTHY"


def duplicate_detected(symbol: str, side: str, magic: int, positions: list[dict], orders: list[dict]) -> bool:
    side_u = side.upper()
    for p in positions:
        if p.get("symbol") == symbol and (p.get("magic") or 0) == magic:
            # position type 0 = BUY, 1 = SELL
            p_side = "BUY" if p.get("type") == 0 else "SELL"
            if p_side == side_u:
                return True
    for o in orders:
        if o.get("symbol") == symbol and (o.get("magic") or 0) == magic:
            o_side = "BUY" if o.get("type") in (2, 4) else "SELL"  # buy limit/stop
            if o_side == side_u:
                return True
    return False


def execution_guard(
    *,
    connected: bool,
    risk_approved: bool,
    governance_approved: bool,
    emergency_stop: bool,
    duplicate: bool,
    order_valid: bool,
) -> tuple[bool, list[str]]:
    """Independent protection layers (section 11). One miss → BLOCKED."""
    reasons: list[str] = []
    if not connected:
        reasons.append("NOT_CONNECTED")
    if not execution_allowed_by_heartbeat():
        reasons.append("HEARTBEAT_NOT_HEALTHY")
    if not risk_approved:
        reasons.append("RISK_NOT_APPROVED")
    if not governance_approved:
        reasons.append("GOVERNANCE_NOT_APPROVED")
    if emergency_stop:
        reasons.append("EMERGENCY_STOP")
    if duplicate:
        reasons.append("DUPLICATE_DETECTED")
    if not order_valid:
        reasons.append("ORDER_INVALID")
    if not settings.is_live_allowed():
        reasons.append("LIVE_EXECUTION_DISABLED")
    return (len(reasons) == 0, reasons)


def assert_live_allowed() -> None:
    """Hard double kill-switch for /orders/execute."""
    if not settings.is_live_allowed():
        raise BridgeError("LIVE_EXECUTION_DISABLED", "live execution disabled", 423)