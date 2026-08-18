"""MetaTrader5 Python wrapper – real calls, no simulation.
Lazy import so the app is importable without MetaTrader5 installed (tests).
Every failure raises BridgeError with a stage + last_error() evaluation.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from .config import settings
from .schemas import BridgeError, SymbolResponse, AccountInfo
from .logging_config import log

_initialized = False


def _mt5():
    try:
        import MetaTrader5 as mt5  # lazy
        return mt5
    except ImportError as e:
        raise BridgeError("MT5_TERMINAL_UNAVAILABLE", f"MetaTrader5 package not installed: {e}", 503, "import")


def _last_error(stage: str) -> str:
    try:
        return str(_mt5().last_error())
    except Exception:
        return "unknown"


def initialize() -> None:
    global _initialized
    if _initialized:
        return
    mt5 = _mt5()
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
        raise BridgeError("MT5_TERMINAL_UNAVAILABLE", f"initialize failed: {_last_error('initialize')}", 503, "initialize")
    _initialized = True
    log.info("mt5.initialized")


def ensure_initialized() -> None:
    if not _initialized:
        initialize()


def terminal_info() -> dict:
    ensure_initialized()
    ti = _mt5().terminal_info()
    if ti is None:
        raise BridgeError("MT5_TERMINAL_DISCONNECTED", f"terminal_info None: {_last_error('terminal_info')}", 503, "terminal_info")
    return ti._asdict()


def account_info() -> AccountInfo:
    ensure_initialized()
    ai = _mt5().account_info()
    if ai is None:
        raise BridgeError("MT5_ACCOUNT_AUTH_FAILED", f"account_info None: {_last_error('account_info')}", 503, "account_info")
    return AccountInfo(
        login="********", server=ai.server, balance=ai.balance, equity=ai.equity,
        margin=ai.margin, free_margin=ai.margin_free, currency=ai.currency,
    )


def discover_symbol(canonical: Optional[str] = None) -> tuple[str, dict]:
    """Try candidate symbols; return (resolved_name, symbol_info_dict). No blind XAUUSD."""
    ensure_initialized()
    mt5 = _mt5()
    canon = canonical or settings.symbol_canonical
    candidates = settings.symbol_candidate_list or [canon]
    for name in candidates:
        si = mt5.symbol_info(name)
        if si is not None:
            return name, si._asdict()
    raise BridgeError("SYMBOL_NOT_FOUND", f"no candidate for {canon}: {candidates}", 404, "symbol_discovery")


def symbol_info(name: str) -> SymbolResponse:
    ensure_initialized()
    mt5 = _mt5()
    si = mt5.symbol_info(name)
    if si is None:
        raise BridgeError("SYMBOL_NOT_FOUND", f"symbol_info None: {name}", 404, "symbol_info")
    tick = mt5.symbol_info_tick(name)
    if tick is None:
        raise BridgeError("MARKET_DATA_UNAVAILABLE", f"tick None: {name}", 503, "symbol_info_tick")
    return SymbolResponse(
        canonical=settings.symbol_canonical, resolved=name,
        visible=bool(si.visible),
        trade_allowed=bool(si.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL),
        bid=tick.bid, ask=tick.ask, spread=(tick.ask - tick.bid),
        tick_size=si.trade_tick_size, tick_value=si.trade_tick_value,
        contract_size=si.trade_contract_size, volume_min=si.volume_min,
        volume_max=si.volume_max, volume_step=si.volume_step,
        stops_level=si.trade_stops_level, freeze_level=si.trade_freeze_level, validated=True,
    )


def symbol_tick(name: str) -> dict:
    ensure_initialized()
    tick = _mt5().symbol_info_tick(name)
    if tick is None:
        raise BridgeError("MARKET_DATA_UNAVAILABLE", f"tick None: {name}", 503, "symbol_info_tick")
    return tick._asdict()


def copy_rates(name: str, timeframe: str = "M1", count: int = 100, start: int = 0) -> list[dict]:
    """Real mt5.copy_rates_from_pos – read-only OHLCV, no order.
    start=0 → most recent candles; start=N → N candles back from now."""
    ensure_initialized()
    mt5 = _mt5()
    # Ensure symbol is in Market Watch — copy_rates_from_pos needs it
    if not mt5.symbol_select(name, True):
        log.warning(f"copy_rates.symbol_select_failed: {name}")
    tf_map = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "H1": mt5.TIMEFRAME_H1,
        "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1,
    }
    tf = tf_map.get(timeframe, mt5.TIMEFRAME_M1)
    rates = mt5.copy_rates_from_pos(name, tf, start, count)
    if rates is None:
        raise BridgeError("MARKET_DATA_UNAVAILABLE", f"copy_rates None: {name} {timeframe}", 503, "copy_rates")
    if len(rates) == 0:
        log.warning(f"copy_rates.empty: {name} {timeframe} count={count} — no history loaded")
    return [
        {
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "tick_volume": int(r["tick_volume"]),
            "real_volume": int(r.get("real_volume", 0)) if hasattr(r, "dtype") else 0,
            "spread": int(r["spread"]) if "spread" in r.dtype.names else 0,
        }
        for r in rates
    ]


def positions_get(magic: Optional[int] = None) -> list[dict]:
    ensure_initialized()
    mt5 = _mt5()
    pos = mt5.positions_get(magic=magic) if magic is not None else mt5.positions_get()
    return [p._asdict() for p in (pos or [])]


def orders_get(magic: Optional[int] = None) -> list[dict]:
    ensure_initialized()
    mt5 = _mt5()
    ords = mt5.orders_get(magic=magic) if magic is not None else mt5.orders_get()
    return [o._asdict() for o in (ords or [])]


def order_check(req: dict) -> dict:
    """Real mt5.order_check – validates WITHOUT sending an order."""
    ensure_initialized()
    result = _mt5().order_check(req)
    if result is None:
        raise BridgeError("ORDER_VALIDATION_FAILED", f"order_check None: {_last_error('order_check')}", 503, "order_check")
    return result._asdict()


def shutdown() -> None:
    global _initialized
    if _initialized:
        try:
            _mt5().shutdown()
        except Exception:
            pass
        _initialized = False
        log.info("mt5.shutdown")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()