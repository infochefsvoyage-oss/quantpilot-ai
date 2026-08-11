from fastapi import APIRouter
from ..mt5_client import now_iso
from ..schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    # Honest default: UI_CONTRACT until a real probe upgrades it.
    # The bridge process running != MT5 reachable; this endpoint only proves FastAPI is up.
    return HealthResponse(
        verification_tier="UI_CONTRACT",
        bridge="HEALTHY",
        mt5_terminal="NOT_VERIFIED",
        account="NOT_VERIFIED",
        market_data="NOT_VERIFIED",
        execution="BLOCKED",
        broker="Vantage",
        platform="MetaTrader 5",
        timestamp=now_iso(),
    )