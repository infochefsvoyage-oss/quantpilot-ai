from fastapi import APIRouter
from ..guards import record_heartbeat, heartbeat_state, execution_allowed_by_heartbeat
from ..schemas import HeartbeatRequest, HeartbeatResponse

router = APIRouter()


@router.get("/heartbeat", response_model=HeartbeatResponse)
def get_heartbeat() -> HeartbeatResponse:
    """Read current heartbeat state without recording a new one."""
    state = heartbeat_state()
    return HeartbeatResponse(state=state, execution_allowed=execution_allowed_by_heartbeat())


@router.post("/heartbeat", response_model=HeartbeatResponse)
def post_heartbeat(req: HeartbeatRequest) -> HeartbeatResponse:
    record_heartbeat()
    state = heartbeat_state()
    # Safety correction: WARNING also blocks execution.
    return HeartbeatResponse(state=state, execution_allowed=execution_allowed_by_heartbeat())