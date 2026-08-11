from fastapi import APIRouter
from ..guards import record_heartbeat, heartbeat_state, execution_allowed_by_heartbeat
from ..schemas import HeartbeatRequest, HeartbeatResponse

router = APIRouter()


@router.post("/heartbeat", response_model=HeartbeatResponse)
def heartbeat(req: HeartbeatRequest) -> HeartbeatResponse:
    record_heartbeat()
    state = heartbeat_state()
    # Safety correction (section 5): WARNING also blocks execution.
    return HeartbeatResponse(state=state, execution_allowed=execution_allowed_by_heartbeat())