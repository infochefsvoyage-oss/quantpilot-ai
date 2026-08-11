from fastapi import APIRouter
from ..mt5_client import discover_symbol, symbol_info
from ..schemas import SymbolResponse, BridgeError

router = APIRouter()


@router.get("/symbols/{symbol}", response_model=SymbolResponse)
def get_symbol(symbol: str) -> SymbolResponse:
    # Discovery first (section 5): never assume a static symbol name.
    resolved, _ = discover_symbol(symbol)
    return symbol_info(resolved)