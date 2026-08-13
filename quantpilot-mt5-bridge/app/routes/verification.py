"""GET /verification – single source of truth for the frontend tier."""
from fastapi import APIRouter
from ..config import settings
from ..guards import heartbeat_state
from ..mt5_client import (
    terminal_info, account_info, discover_symbol, symbol_info, symbol_tick,
    positions_get, order_check, now_iso,
)
from ..schemas import VerificationResponse, BridgeError

router = APIRouter()


def _try(fn, *a, **kw):
    try:
        return fn(*a, **kw), None
    except BridgeError as e:
        return None, e


@router.get("/verification", response_model=VerificationResponse)
def verification() -> VerificationResponse:
    bridge = True  # endpoint responding => bridge process is up
    mt5 = account = symbol = tick = positions = order_check_ok = False
    resolved = None

    if _try(terminal_info)[0] is not None:
        mt5 = True
    if _try(account_info)[0] is not None:
        account = True
    disc = _try(discover_symbol)[0]
    if disc:
        resolved = disc[0]
        if _try(symbol_info, resolved)[0] is not None:
            si = _try(symbol_info, resolved)[0]
            symbol = si is not None and si.validated
    if resolved:
        tick = _try(symbol_tick, resolved)[0] is not None
    if _try(positions_get)[0] is not None:
        positions = True
    hb = heartbeat_state() == "HEALTHY"

    if resolved and tick:
        try:
            import MetaTrader5 as mt5
            req = {
                "action": mt5.TRADE_ACTION_PENDING, "symbol": resolved, "volume": 0.01,
                "type": mt5.ORDER_TYPE_BUY, "price": 0, "sl": 0, "tp": 0,
                "magic": settings.login or 777077, "deviation": 20,
                "type_filling": mt5.ORDER_FILLING_RETURN, "type_time": mt5.ORDER_TIME_GTC,
            }
            order_check(req)
            order_check_ok = True
        except BridgeError:
            order_check_ok = False
        except Exception:
            order_check_ok = False

    all_ok = all([mt5, account, symbol, tick, positions, hb, order_check_ok])
    tier = "MT5_E2E_CONNECTED" if all_ok else ("BACKEND_CONNECTED" if bridge else "UI_CONTRACT")
    return VerificationResponse(
        tier=tier, bridge=bridge, mt5=mt5, account=account, symbol=symbol,
        tick=tick, positions=positions, heartbeat=hb, order_check=order_check_ok,
        live_execution_blocked=not settings.is_live_allowed(), timestamp=now_iso(),
    )