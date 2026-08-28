"""Execution Guard, Heartbeat & Duplicate Guard (sections 8, 9, 11).

Heartbeat POST monitoring (section 8 extension):
  heartbeat_post_success        – count of POSTs that reached the bridge
  heartbeat_post_failures       – inferred from gaps (proxy 502s don't reach FastAPI)
  heartbeat_last_success_at      – epoch of last successful POST
  heartbeat_last_failure_at      – epoch of last inferred failure
  heartbeat_consecutive_failures – current streak of missed POSTs
  heartbeat_failure_rate         – failures / (successes + failures)

HEARTBEAT_HEALTHY reflects ONLY the freshness of the last successful EA POST.
A successful GET never masks POST failures — GET does not update _last_heartbeat.
"""
from __future__ import annotations
import time
from typing import Optional
from .config import settings
from .schemas import BridgeError


# ---- Heartbeat freshness (updated only by POST) ----
_last_heartbeat: Optional[float] = None
_last_heartbeat_payload: Optional[dict] = None

# ---- POST monitoring metrics (section 8) ----
_post_success: int = 0
_post_failures: int = 0          # inferred from gaps — proxy 502s never reach FastAPI
_last_success_at: Optional[float] = None
_last_failure_at: Optional[float] = None
_consecutive_failures: int = 0
_last_post_at: Optional[float] = None  # for gap-based failure inference


def record_heartbeat(payload: Optional[dict] = None) -> None:
    """Record a successful POST and infer failures from the gap since last POST.

    The EA posts every HeartbeatIntervalSec (5s). If the gap between two
    successful POSTs exceeds 2× heartbeat_healthy_seconds (20s), POSTs were
    lost — most likely a proxy 502 (threadpool exhaustion, backend restart,
    network drop). We infer the missed count and timestamp conservatively.
    """
    global _last_heartbeat, _last_heartbeat_payload, _post_success, _post_failures
    global _last_success_at, _last_failure_at, _consecutive_failures, _last_post_at

    now = time.time()

    # Infer failures from gap (only if we have a previous POST to compare)
    if _last_post_at is not None:
        gap = now - _last_post_at
        expected_interval = settings.heartbeat_interval_seconds
        gap_threshold = 2 * expected_interval
        if gap > gap_threshold:
            # Infer the number of missed EA heartbeat intervals.
            missed = max(1, int(gap / expected_interval) - 1)
            _post_failures += missed
            _consecutive_failures = missed
            _last_failure_at = _last_post_at  # failure happened right after last success
        else:
            _consecutive_failures = 0

    _last_post_at = now
    _last_heartbeat = now
    _last_heartbeat_payload = payload
    _post_success += 1
    _last_success_at = now


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


def last_heartbeat_timestamp() -> Optional[float]:
    """Return the raw epoch timestamp of the last EA heartbeat post, or None."""
    return _last_heartbeat


def last_heartbeat_payload() -> Optional[dict]:
    return _last_heartbeat_payload


# ---- POST monitoring metrics (section 8) ----

def heartbeat_post_success() -> int:
    return _post_success


def heartbeat_post_failures() -> int:
    return _post_failures


def heartbeat_last_success_at() -> Optional[float]:
    return _last_success_at


def heartbeat_last_failure_at() -> Optional[float]:
    return _last_failure_at


def heartbeat_consecutive_failures() -> int:
    return _consecutive_failures


def heartbeat_failure_rate() -> float:
    """failures / (successes + failures). 0.0 if no data yet."""
    total = _post_success + _post_failures
    if total == 0:
        return 0.0
    return round(_post_failures / total, 4)


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