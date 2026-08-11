"""MetaTrader5 Python wrapper – real calls, no simulation. Raises BridgeError on failure."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
import MetaTrader5 as mt5

from .config import settings
from .schemas import BridgeError, SymbolResponse, AccountInfo
from .logging_config import log


_initialized = False


def initialize() -> None:
    global _initialized
    if _initialized:
        return
    kwargs = {}
    if settings.terminal_path:
        kwargs["path"] = settings.terminal_path
    if settings.login:
        kwargs["login"] = settings.login
    if settings.server:
        kwargs["server"] = settings.server
    if settings.password:
        kwargs["password"] = settings.password
    ok = mt5.initialize(**kwargs)
    if not ok:
        code = mt5.last_error()[0]
        log.error("mt5.initialize.failed", mt5_error_code=code)
        raise BridgeError("MT5_TERMINAL_UNAVAILABLE", f"initialize failed: {mt5.last_error()}", 503)
    _initialized = True
    log.info("mt5.initialized")


def ensure_initialized() -> None:
    if not _initialized:
        initialize()


def terminal_info() -> dict:
    ensure_initialized()
    ti = mt5.terminal_info()
    if ti is None:
        raise BridgeError("MT5_TERMINAL_DISCONNECTED", "terminal_info() returned None", 503)
    return ti._asdict()


def account_info() -> AccountInfo:
    ensure_initialized()
    ai = mt5.account_info()
    if ai is None:
        raise BridgeError("MT5_ACCOUNT_AUTH_FAILED", "account_info() returned None", 503)
    return AccountInfo(
        login="********",
        server=ai.server,
        balance=ai.balance,
        equity=ai.equity,
        margin=ai.margin,
        free_margin=ai.margin_free,
        currency=ai.currency,
    )


def discover_symbol(canonical: Optional[str] = None) -> tuple[str, dict]:
    """Try candidate symbols; return (resolved_name, symbol_info_dict). No blind XAUUSD."""
    ensure_initialized()
    canon = canonical or settings.symbol_canonical
    candidates = settings.symbol_candidate_list or [canon]
    for name in candidates:
        si = mt5.symbol_info(name)
        if si is not None:
            return name, si._asdict()
    raise BridgeError("SYMBOL_NOT_FOUND", f"no candidate found for {canon}: {candidates}", 404)


def symbol_info(name: str) -> SymbolResponse:
    ensure_initialized()
    si = mt5.symbol_info(name)
    if si is None:
        raise BridgeError("SYMBOL_NOT_FOUND", name, 404)
    tick = mt5.symbol_info_tick(name)
    if tick is None:
        raise BridgeError("MARKET_DATA_UNAVAILABLE", name, 503)
    return SymbolResponse(
        canonical=settings.symbol_canonical,
        resolved=name,
        visible=bool(si.visible),
        trade_allowed=bool(si.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL),
        bid=tick.bid,
        ask=tick.ask,
        spread=(tick.ask - tick.bid),
        tick_size=si.trade_tick_size,
        tick_value=si.trade_tick_value,
        contract_size=si.trade_contract_size,
        volume_min=si.volume_min,
        volume_max=si.volume_max,
        volume_step=si.volume_step,
        stops_level=si.trade_stops_level,
        freeze_level=si.trade_freeze_level,
        validated=True,
    )


def symbol_tick(name: str) -> dict:
    ensure_initialized()
    tick = mt5.symbol_info_tick(name)
    if tick is None:
        raise BridgeError("MARKET_DATA_UNAVAILABLE", name, 503)
    return tick._asdict()


def positions_get(magic: Optional[int] = None) -> list[dict]:
    ensure_initialized()
    pos = mt5.positions_get(magic=magic) if magic is not None else mt5.positions_get()
    return [p._asdict() for p in (pos or [])]


def orders_get(magic: Optional[int] = None) -> list[dict]:
    ensure_initialized()
    ords = mt5.orders_get(magic=magic) if magic is not None else mt5.orders_get()
    return [o._asdict() for o in (ords or [])]


def order_check(req: dict) -> dict:
    """Real mt5.order_check – validates request WITHOUT sending an order."""
    ensure_initialized()
    result = mt5.order_check(req)
    if result is None:
        raise BridgeError("ORDER_VALIDATION_FAILED", "order_check() returned None", 503)
    return result._asdict()


def shutdown() -> None:
    global _initialized
    if _initialized:
        mt5.shutdown()
        _initialized = False
        log.info("mt5.shutdown")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()