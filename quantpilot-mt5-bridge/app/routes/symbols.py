from fastapi import APIRouter, Query
import time
from ..mt5_client import discover_symbol, symbol_info, symbol_tick, symbol_rates
from ..schemas import SymbolResponse, SymbolTickResponse, RatesResponse

router = APIRouter()


@router.get("/symbols/{symbol}", response_model=SymbolResponse)
def get_symbol(symbol: str) -> SymbolResponse:
    # Discovery first (section 10): never assume a static symbol name.
    resolved, _ = discover_symbol(symbol)
    return symbol_info(resolved)


@router.get("/symbols/{symbol}/tick", response_model=SymbolTickResponse)
def get_symbol_tick(symbol: str) -> SymbolTickResponse:
    resolved, _ = discover_symbol(symbol)
    tick = symbol_tick(resolved)
    return SymbolTickResponse(
        symbol=resolved, bid=tick.get("bid", 0), ask=tick.get("ask", 0),
        last=tick.get("last", 0), time=tick.get("time", 0),
        server_time_ms=int(time.time() * 1000), available=True,
    )


@router.get("/symbols/{symbol}/rates", response_model=RatesResponse)
def get_symbol_rates(
    symbol: str,
    timeframe: str = Query("M1", regex="^(M1|M2|M3|M4|M5|M6|M10|M12|M15|M20|M30|H1|H2|H3|H4|H6|H8|H12|D1|W1|MN1)$"),
    count: int = Query(100, ge=1, le=5000),
    start: int = Query(0, ge=0, le=100000),
) -> RatesResponse:
    # Read-only OHLCV for ICT engine — no order, no execution.
    # start=0 → most recent; start=N → N candles back (historical batch support).
    resolved, _ = discover_symbol(symbol)
    candles = symbol_rates(resolved, timeframe, count, start)
    return RatesResponse(
        symbol=resolved, timeframe=timeframe, count=len(candles), start=start,
        rates=candles, server_time_ms=int(time.time() * 1000), available=True,
    )