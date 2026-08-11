from fastapi import APIRouter
from ..config import settings
from ..guards import execution_guard, duplicate_detected, heartbeat_state
from ..mt5_client import discover_symbol, symbol_info, positions_get, orders_get, order_check
from ..schemas import (
    ValidateOrderRequest, ValidateOrderResponse, ExecuteResponse,
    OrderCheckResponse, BridgeError,
)

router = APIRouter()


@router.post("/order-check", response_model=OrderCheckResponse)
def order_check_only(req: ValidateOrderRequest) -> OrderCheckResponse:
    """Dedicated MT5 order_check – never sends an order."""
    try:
        resolved, _ = discover_symbol(req.symbol)
        info = symbol_info(resolved)
        import MetaTrader5 as mt5
        price = info.ask if req.side == "BUY" else info.bid
        trade_req = {
            "action": mt5.TRADE_ACTION_PENDING, "symbol": resolved, "volume": req.volume,
            "type": mt5.ORDER_TYPE_BUY if req.side == "BUY" else mt5.ORDER_TYPE_SELL,
            "price": price, "sl": req.stop_loss, "tp": req.take_profit,
            "magic": settings.login or 777077, "deviation": 20,
            "type_filling": mt5.ORDER_FILLING_RETURN, "type_time": mt5.ORDER_TIME_GTC,
        }
        result = order_check(trade_req)
        return OrderCheckResponse(
            ok=result.get("retcode") == 0 or result.get("retcode") == 10009,
            retcode=result.get("retcode", 0), comment=result.get("comment", ""), stage="order_check",
        )
    except BridgeError as e:
        return OrderCheckResponse(ok=False, retcode=0, comment=e.code, stage=e.stage)


@router.post("/orders/validate", response_model=ValidateOrderResponse)
def validate_order(req: ValidateOrderRequest) -> ValidateOrderResponse:
    reasons: list[str] = []
    resolved = None
    order_check_result = None

    if heartbeat_state() != "HEALTHY":
        reasons.append("HEARTBEAT_NOT_HEALTHY")

    try:
        resolved, _ = discover_symbol(req.symbol)
        info = symbol_info(resolved)
    except BridgeError as e:
        reasons.append(e.code)
        return ValidateOrderResponse(valid=False, execution="BLOCKED", reasons=reasons)

    if req.volume < info.volume_min or req.volume > info.volume_max:
        reasons.append("VOLUME_OUT_OF_RANGE")
    if info.volume_step and (round(req.volume / info.volume_step) * info.volume_step != req.volume):
        reasons.append("LOT_STEP_INVALID")

    price = info.ask if req.side == "BUY" else info.bid
    if abs(price - req.stop_loss) < info.stops_level * info.tick_size:
        reasons.append("SL_TOO_CLOSE")
    if abs(req.take_profit - price) < info.stops_level * info.tick_size:
        reasons.append("TP_TOO_CLOSE")
    if info.spread <= 0:
        reasons.append("SPREAD_INVALID")

    pos = positions_get()
    ords = orders_get()
    if duplicate_detected(resolved, req.side, settings.login or 777077, pos, ords):
        reasons.append("DUPLICATE_DETECTED")

    if not req.risk_approved:
        reasons.append("RISK_NOT_APPROVED")
    if not req.governance_approved:
        reasons.append("GOVERNANCE_NOT_APPROVED")
    if req.emergency_stop:
        reasons.append("EMERGENCY_STOP")

    try:
        import MetaTrader5 as mt5
        trade_req = {
            "action": mt5.TRADE_ACTION_PENDING, "symbol": resolved, "volume": req.volume,
            "type": mt5.ORDER_TYPE_BUY if req.side == "BUY" else mt5.ORDER_TYPE_SELL,
            "price": price, "sl": req.stop_loss, "tp": req.take_profit,
            "magic": settings.login or 777077, "deviation": 20,
            "type_filling": mt5.ORDER_FILLING_RETURN, "type_time": mt5.ORDER_TIME_GTC,
        }
        order_check_result = order_check(trade_req)
        if order_check_result.get("retcode") not in (0, 10009):
            reasons.append("ORDER_CHECK_FAILED")
    except BridgeError as e:
        reasons.append(e.code)

    allowed, guard_reasons = execution_guard(
        connected=True, risk_approved=req.risk_approved,
        governance_approved=req.governance_approved, emergency_stop=req.emergency_stop,
        duplicate="DUPLICATE_DETECTED" in reasons, order_valid=len(reasons) == 0,
    )
    reasons.extend(guard_reasons)

    valid = len(reasons) == 0
    return ValidateOrderResponse(
        valid=valid, execution="VALID" if valid else "BLOCKED",
        resolved_symbol=resolved, reasons=reasons, order_check=order_check_result,
    )


@router.post("/orders/execute", response_model=ExecuteResponse)
def execute_order() -> ExecuteResponse:
    # HARD BLOCK. order_send() is never called. Kill-switches in guards.assert_live_allowed.
    return ExecuteResponse(execution="BLOCKED", reason="LIVE_EXECUTION_DISABLED")