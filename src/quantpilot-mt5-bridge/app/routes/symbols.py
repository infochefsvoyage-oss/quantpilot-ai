from fastapi import APIRouter
from ..mt5_client import discover_symbol, symbol_info, symbol_tick
from ..schemas import SymbolResponse, SymbolTickResponse, BridgeError

router = APIRouter()


@router.get("/symbols/{symbol}", response_model=SymbolResponse)
def get_symbol(symbol: str) -> SymbolResponse:
    # Discovery first (section 6): never assume a static symbol name.
    resolved, _ = discover_symbol(symbol)
    return symbol_info(resolved)


@router.get("/symbols/{symbol}/tick", response_model=SymbolTickResponse)
def get_symbol_tick(symbol: str) -> SymbolTickResponse:
    resolved, _ = discover_symbol(symbol)
    tick = symbol_tick(resolved)
    return SymbolTickResponse(
        symbol=resolved, bid=tick.get("bid", 0), ask=tick.get("ask", 0),
        last=tick.get("last", 0), time=tick.get("time", 0),
        available=True,
    )