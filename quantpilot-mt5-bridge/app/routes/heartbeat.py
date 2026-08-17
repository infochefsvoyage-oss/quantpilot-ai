from fastapi import APIRouter
from datetime import datetime, timezone
from ..guards import (
    record_heartbeat, heartbeat_state, heartbeat_reason,
    heartbeat_age_seconds, last_heartbeat_payload,
    execution_allowed_by_heartbeat,
)
from ..schemas import HeartbeatRequest, HeartbeatResponse

router = APIRouter()


def _iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


@router.get("/heartbeat", response_model=HeartbeatResponse)
def get_heartbeat() -> HeartbeatResponse:
    """Read current heartbeat state without recording a new one."""
    state = heartbeat_state()
    reason = heartbeat_reason()
    payload = last_heartbeat_payload() or {}
    return HeartbeatResponse(
        state=state,
        reason=reason,
        execution_allowed=execution_allowed_by_heartbeat(),
        last_heartbeat_at=_iso(__import__("time").time() if state != "STALE" else None) if reason == "HEARTBEAT_HEALTHY" else _iso(__import__("time").time()),
        heartbeat_age_s=heartbeat_age_seconds(),
        ea_id=payload.get("ea_id"),
        version=payload.get("version"),
    )


@router.post("/heartbeat", response_model=HeartbeatResponse)
def post_heartbeat(req: HeartbeatRequest) -> HeartbeatResponse:
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
        last_heartbeat_at=_iso(__import__("time").time()),
        heartbeat_age_s=heartbeat_age_seconds(),
        ea_id=req.ea_id,
        version=req.version,
    )