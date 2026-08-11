from fastapi import APIRouter
from ..mt5_client import account_info
from ..schemas import AccountResponse, BridgeError

router = APIRouter()


@router.get("/account", response_model=AccountResponse)
def account() -> AccountResponse:
    try:
        ai = account_info()
        return AccountResponse(connected=True, account=ai)
    except BridgeError as e:
        # Honest: not connected → do not fake balance/equity
        return AccountResponse(connected=False, account=ai_default())


def ai_default():
    from ..schemas import AccountInfo
    return AccountInfo()