"""Heartbeat endpoints — async to avoid threadpool contention (root-cause fix for 502).

Root cause of intermittent HTTP 502 on POST /heartbeat:
  All bridge routes were `def` (sync). FastAPI runs sync endpoints in a
  threadpool (default 40 threads). /verification alone makes 7+ blocking MT5
  calls sequentially. When fetchMT5Snapshot fires 6 parallel requests AND
  MT5 is slow, the threadpool exhausts → EA's POST /heartbeat queues behind
  blocking MT5 calls → reverse proxy timeout → 502 Bad Gateway.

  Fix: heartbeat endpoints are `async def` — record_heartbeat() and
  heartbeat_state() are pure Python (no I/O), so they run in the event loop
  without waiting for a threadpool thread. GET and POST never block on MT5.

  HEARTBEAT_HEALTHY reflects ONLY the last successful EA POST.
  GET does NOT update _last_heartbeat — it only reads state.
"""
from fastapi import APIRouter
from datetime import datetime, timezone
from ..guards import (
    record_heartbeat, heartbeat_state, heartbeat_reason,
    heartbeat_age_seconds, last_heartbeat_payload, last_heartbeat_timestamp,
    execution_allowed_by_heartbeat,
    heartbeat_post_success, heartbeat_post_failures,
    heartbeat_last_success_at, heartbeat_last_failure_at,
    heartbeat_consecutive_failures, heartbeat_failure_rate,
)
from ..schemas import HeartbeatRequest, HeartbeatResponse

router = APIRouter()


def _iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


@router.get("/heartbeat", response_model=HeartbeatResponse)
async def get_heartbeat() -> HeartbeatResponse:
    """Read current heartbeat state without recording a new one.

    GET does NOT update _last_heartbeat — it only reads the state set by
    the last successful POST. This ensures a successful GET never masks
    POST failures (section 8 requirement).
    """
    state = heartbeat_state()
    reason = heartbeat_reason()
    payload = last_heartbeat_payload() or {}
    return HeartbeatResponse(
        state=state,
        reason=reason,
        execution_allowed=execution_allowed_by_heartbeat(),
        last_heartbeat_at=_iso(last_heartbeat_timestamp()),
        heartbeat_age_s=heartbeat_age_seconds(),
        ea_id=payload.get("ea_id"),
        version=payload.get("version"),
        post_success=heartbeat_post_success(),
        post_failures=heartbeat_post_failures(),
        last_success_at=_iso(heartbeat_last_success_at()),
        last_failure_at=_iso(heartbeat_last_failure_at()),
        consecutive_failures=heartbeat_consecutive_failures(),
        failure_rate=heartbeat_failure_rate(),
    )


@router.post("/heartbeat", response_model=HeartbeatResponse)
async def post_heartbeat(req: HeartbeatRequest) -> HeartbeatResponse:
    """Record a new EA heartbeat POST and return current state.

    This is the ONLY endpoint that updates _last_heartbeat and the POST
    success counter. Failures (proxy 502) are inferred from gaps in
    record_heartbeat() — see guards.py.
    """
    record_heartbeat({
        "ea_id": req.ea_id,
        "version": req.version,
        "account": req.account,
        "symbols": req.symbols,
        "timestamp": req.timestamp,
        "server_time": req.server_time,
        "state": req.state,
        "last_tick_time": req.last_tick_time,
    })
    state = heartbeat_state()
    # Safety correction (section 5): WARNING also blocks execution.
    return HeartbeatResponse(
        state=state,
        reason=heartbeat_reason(),
        execution_allowed=execution_allowed_by_heartbeat(),
        last_heartbeat_at=_iso(last_heartbeat_timestamp()),
        heartbeat_age_s=heartbeat_age_seconds(),
        ea_id=req.ea_id,
        version=req.version,
        post_success=heartbeat_post_success(),
        post_failures=heartbeat_post_failures(),
        last_success_at=_iso(heartbeat_last_success_at()),
        last_failure_at=_iso(heartbeat_last_failure_at()),
        consecutive_failures=heartbeat_consecutive_failures(),
        failure_rate=heartbeat_failure_rate(),
    )