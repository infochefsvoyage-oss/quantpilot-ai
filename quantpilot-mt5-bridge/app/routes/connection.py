from fastapi import APIRouter
from ..config import settings
from ..guards import heartbeat_state, execution_allowed_by_heartbeat
from ..mt5_client import terminal_info
from ..schemas import ConnectionResponse, BridgeError

router = APIRouter()


@router.get("/connection", response_model=ConnectionResponse)
def connection() -> ConnectionResponse:
    hb = heartbeat_state()
    mt5_ok = False
    server = None
    state = "BRIDGE_HEALTHY"
    try:
        ti = terminal_info()
        mt5_ok = True
        server = settings.expected_server
        state = "MT5_TERMINAL_CONNECTED"
    except BridgeError:
        mt5_ok = False
        state = "BRIDGE_HEALTHY"
    tier = "BACKEND_CONNECTED" if mt5_ok else "UI_CONTRACT"
    return ConnectionResponse(
        connected=mt5_ok,
        verification_tier=tier,
        state=state,
        server=server,
        execution_mode="READ_ONLY",
        live_execution_blocked=not settings.is_live_allowed(),
        heartbeat_state=hb,
    )