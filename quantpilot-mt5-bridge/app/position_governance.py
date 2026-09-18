"""QuantPilot position-management governance. Fail closed."""
from __future__ import annotations

CORE_LONG_TICKETS = {138589574}
HEDGE_TICKET = 138887012
HEDGE_STEP_MAX = 0.01


def position_management_guard(ticket: int, side: str, action: str) -> tuple[bool, list[str]]:
    """Protect the strategic core long from every automatic CLOSE/REDUCE."""
    reasons: list[str] = []
    side_u = str(side).upper()
    action_u = str(action).upper()

    if int(ticket) in CORE_LONG_TICKETS and side_u == "BUY" and action_u in {"CLOSE", "REDUCE"}:
        reasons.extend(["CORE_LONG_LOCKED", "LONG_MAY_CLOSE_FALSE", "AUTO_CLOSE_LONG_FALSE"])

    if action_u == "REDUCE" and int(ticket) != HEDGE_TICKET:
        reasons.append("HEDGE_IDENTITY_MISMATCH")

    return (len(reasons) == 0, reasons)


def validate_hedge_step(ticket: int, side: str, volume: float) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if int(ticket) != HEDGE_TICKET:
        reasons.append("HEDGE_IDENTITY_MISMATCH")
    if str(side).upper() != "SELL":
        reasons.append("HEDGE_SIDE_MISMATCH")
    if volume <= 0 or volume > HEDGE_STEP_MAX + 1e-12:
        reasons.append("HEDGE_STEP_INVALID")
    return (len(reasons) == 0, reasons)
