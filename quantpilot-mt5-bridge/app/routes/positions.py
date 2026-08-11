from fastapi import APIRouter
from ..mt5_client import positions_get, orders_get
from ..schemas import PositionsResponse, PositionItem, OrderItem

router = APIRouter()


@router.get("/positions", response_model=PositionsResponse)
def positions() -> PositionsResponse:
    pos = positions_get()
    ords = orders_get()
    return PositionsResponse(
        positions=[
            PositionItem(
                ticket=p["ticket"], symbol=p["symbol"],
                side="BUY" if p["type"] == 0 else "SELL",
                volume=p["volume"], entry=p["price_open"],
                sl=p["sl"], tp=p["tp"], profit=p["profit"], magic=p.get("magic", 0),
            ) for p in pos
        ],
        pending_orders=[
            OrderItem(
                ticket=o["ticket"], symbol=o["symbol"],
                side="BUY" if o["type"] in (2, 4) else "SELL",
                volume=o["volume_current"], price=o["price_open"],
                sl=o["sl"], tp=o["tp"], type=str(o["type"]), magic=o.get("magic", 0),
            ) for o in ords
        ],
    )