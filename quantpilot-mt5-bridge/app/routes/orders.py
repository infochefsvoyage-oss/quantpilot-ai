import MetaTrader5 as mt5
from fastapi import APIRouter
from ..config import settings
from ..guards import execution_guard, duplicate_detected, heartbeat_state
from ..mt5_client import discover_symbol, symbol_info, positions_get, orders_get, order_check
from ..schemas import ValidateOrderRequest, ValidateOrderResponse, BridgeError

router = APIRouter()


@router.post("/orders/validate", response_model=ValidateOrderResponse)
def validate_order(req: ValidateOrderRequest) -> ValidateOrderResponse:
    reasons: list[str] = []
    resolved = None
    order_check_result = None

    # 1. Connection / heartbeat
    if heartbeat_state() != "HEALTHY":
        reasons.append("HEARTBEAT_NOT_HEALTHY")

    # 2. Symbol discovery + real market data
    try:
        resolved, _ = discover_symbol(req.symbol)
        info = symbol_info(resolved)
    except BridgeError as e:
        reasons.append(e.code)
        return ValidateOrderResponse(valid=False, execution="BLOCKED", reasons=reasons)

    # 3. Volume / lot-step
    if req.volume < info.volume_min or req.volume > info.volume_max:
        reasons.append("VOLUME_OUT_OF_RANGE")
    if info.volume_step and (round(req.volume / info.volume_step) * info.volume_step != req.volume):
        reasons.append("LOT_STEP_INVALID")

    # 4. SL / TP vs stops_level / freeze_level
    price = info.ask if req.side == "BUY" else info.bid
    sl_dist = abs(price - req.stop_loss)
    tp_dist = abs(req.take_profit - price)
    if sl_dist < info.stops_level * info.tick_size:
        reasons.append("SL_TOO_CLOSE")
    if tp_dist < info.stops_level * info.tick_size:
        reasons.append("TP_TOO_CLOSE")

    # 5. Spread acceptability (simple guard)
    if info.spread <= 0:
        reasons.append("SPREAD_INVALID")

    # 6. Duplicate guard: positions_get + orders_get (section 9)
    pos = positions_get()
    ords = orders_get()
    if duplicate_detected(resolved, req.side, settings.login, pos, ords):
        reasons.append("DUPLICATE_DETECTED")

    # 7. Risk / governance / emergency (passed by QuantPilot)
    if not req.risk_approved:
        reasons.append("RISK_NOT_APPROVED")
    if not req.governance_approved:
        reasons.append("GOVERNANCE_NOT_APPROVED")
    if req.emergency_stop:
        reasons.append("EMERGENCY_STOP")

    # 8. Real MT5 order_check (section 3) – never sends an order
    try:
        trade_req = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": resolved,
            "volume": req.volume,
            "type": mt5.ORDER_TYPE_BUY if req.side == "BUY" else mt5.ORDER_TYPE_SELL,
            "price": price,
            "sl": req.stop_loss,
            "tp": req.take_profit,
            "magic": settings.login,
            "deviation": 20,
            "type_filling": mt5.ORDER_FILLING_RETURN,
            "type_time": mt5.ORDER_TIME_GTC,
        }
        order_check_result = order_check(trade_req)
        if order_check_result.get("retcode") != mt5.TRADE_RETCODE_DONE:
            reasons.append("ORDER_CHECK_FAILED")
    except BridgeError as e:
        reasons.append(e.code)

    # 9. Execution guard (section 11) – live kill-switch included
    allowed, guard_reasons = execution_guard(
        connected=True,
        risk_approved=req.risk_approved,
        governance_approved=req.governance_approved,
        emergency_stop=req.emergency_stop,
        duplicate="DUPLICATE_DETECTED" in reasons,
        order_valid=len(reasons) == 0,
    )
    reasons.extend(guard_reasons)

    valid = len(reasons) == 0
    return ValidateOrderResponse(
        valid=valid,
        execution="VALID" if valid else "BLOCKED",
        resolved_symbol=resolved,
        reasons=reasons,
        order_check=order_check_result,
    )


@router.post("/orders/execute")
def execute_order():
    # /orders/execute exists but is hard-blocked (section 4 of user spec).
    from ..schemas import ExecuteResponse
    return ExecuteResponse(execution="BLOCKED", reason="LIVE_EXECUTION_DISABLED")