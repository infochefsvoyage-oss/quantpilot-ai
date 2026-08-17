"""Pydantic schemas + canonical error codes (section 16)."""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---- Verification tiers / states ----
VerificationTier = Literal["UI_CONTRACT", "BACKEND_CONNECTED", "MT5_E2E_CONNECTED"]
BridgeState = Literal[
    "DISCONNECTED", "BRIDGE_HEALTHY", "MT5_TERMINAL_CONNECTED",
    "ACCOUNT_VERIFIED", "SYMBOL_VERIFIED", "MARKET_DATA_VERIFIED",
    "POSITIONS_VERIFIED", "E2E_FAILED",
]

# ---- Error codes (section 16) ----
ErrorCode = Literal[
    "MT5_TERMINAL_UNAVAILABLE", "MT5_TERMINAL_DISCONNECTED", "MT5_ACCOUNT_AUTH_FAILED",
    "SYMBOL_NOT_FOUND", "MARKET_DATA_UNAVAILABLE", "HEARTBEAT_STALE",
    "ORDER_VALIDATION_FAILED", "LIVE_EXECUTION_DISABLED", "DUPLICATE_DETECTED",
    "RISK_NOT_APPROVED", "GOVERNANCE_NOT_APPROVED", "EMERGENCY_STOP",
    "NON_PRODUCTION", "UNAUTHORIZED",
]


class BridgeError(Exception):
    def __init__(self, code: ErrorCode, detail: str = "", status: int = 503, stage: str = ""):
        self.code = code
        self.detail = detail
        self.status = status
        self.stage = stage
        super().__init__(code)


class HealthResponse(BaseModel):
    verification_tier: VerificationTier = "UI_CONTRACT"
    bridge: Literal["NOT_CONNECTED", "HEALTHY", "UNHEALTHY"] = "NOT_CONNECTED"
    mt5_terminal: Literal["NOT_VERIFIED", "CONNECTED", "DISCONNECTED"] = "NOT_VERIFIED"
    account: Literal["NOT_VERIFIED", "VERIFIED", "FAILED"] = "NOT_VERIFIED"
    market_data: Literal["NOT_VERIFIED", "AVAILABLE", "UNAVAILABLE"] = "NOT_VERIFIED"
    execution: Literal["BLOCKED", "ALLOWED"] = "BLOCKED"
    broker: Optional[str] = None
    platform: Optional[str] = None
    timestamp: str


class ConnectionResponse(BaseModel):
    connected: bool
    verification_tier: VerificationTier
    state: BridgeState
    server: Optional[str] = None
    execution_mode: Literal["READ_ONLY", "PAPER", "LIVE"] = "READ_ONLY"
    live_execution_blocked: bool = True
    heartbeat_state: Literal["HEALTHY", "WARNING", "STALE", "UNKNOWN"] = "UNKNOWN"


class AccountInfo(BaseModel):
    login: str = "********"
    server: Optional[str] = None
    balance: float = 0
    equity: float = 0
    margin: float = 0
    free_margin: float = 0
    currency: str = "USD"


class AccountResponse(BaseModel):
    connected: bool
    account: AccountInfo


class SymbolResponse(BaseModel):
    canonical: str
    resolved: Optional[str] = None
    visible: bool = False
    trade_allowed: bool = False
    bid: float = 0
    ask: float = 0
    spread: float = 0
    tick_size: float = 0
    tick_value: float = 0
    contract_size: float = 0
    volume_min: float = 0
    volume_max: float = 0
    volume_step: float = 0
    stops_level: int = 0
    freeze_level: int = 0
    validated: bool = False


class PositionItem(BaseModel):
    ticket: int
    symbol: str
    side: str
    volume: float
    entry: float
    sl: float
    tp: float
    profit: float
    magic: int = 0


class OrderItem(BaseModel):
    ticket: int
    symbol: str
    side: str
    volume: float
    price: float
    sl: float
    tp: float
    type: str
    magic: int = 0


class PositionsResponse(BaseModel):
    positions: list[PositionItem] = []
    pending_orders: list[OrderItem] = []


class HeartbeatRequest(BaseModel):
    ea_id: str
    version: str = "1.0.0"
    account: str = "********"
    symbols: list[str] = []
    timestamp: str
    server_time: Optional[str] = None
    state: Optional[str] = None
    last_tick_time: Optional[str] = None


class HeartbeatResponse(BaseModel):
    state: Literal["HEALTHY", "WARNING", "STALE"]
    reason: Literal[
        "HEARTBEAT_HEALTHY",
        "EA_NOT_RUNNING",
        "EA_HEARTBEAT_NOT_RECEIVED",
        "HEARTBEAT_STALE",
    ] = "EA_NOT_RUNNING"
    execution_allowed: bool = False
    last_heartbeat_at: Optional[str] = None
    heartbeat_age_s: Optional[float] = None
    ea_id: Optional[str] = None
    version: Optional[str] = None


class ValidateOrderRequest(BaseModel):
    signal_id: str
    symbol: str
    side: Literal["BUY", "SELL"]
    volume: float
    entry: float
    stop_loss: float
    take_profit: float
    strategy: str = "ASCAN_ICT_SNIPER"
    risk_approved: bool = False
    governance_approved: bool = False
    emergency_stop: bool = False


class ValidateOrderResponse(BaseModel):
    valid: bool
    execution: Literal["BLOCKED", "VALID"] = "BLOCKED"
    resolved_symbol: Optional[str] = None
    reasons: list[str] = []
    order_check: Optional[dict] = None


class ExecuteResponse(BaseModel):
    execution: Literal["BLOCKED", "ALLOWED"] = "BLOCKED"
    reason: str = "LIVE_EXECUTION_DISABLED"


class SymbolTickResponse(BaseModel):
    symbol: str
    bid: float = 0
    ask: float = 0
    last: float = 0
    time: int = 0
    server_time_ms: int = 0
    available: bool = False


class OrderCheckResponse(BaseModel):
    ok: bool
    retcode: int = 0
    comment: str = ""
    stage: str = "order_check"


class VerificationResponse(BaseModel):
    tier: VerificationTier = "UI_CONTRACT"
    bridge: bool = False
    mt5: bool = False
    account: bool = False
    symbol: bool = False
    tick: bool = False
    positions: bool = False
    heartbeat: bool = False
    heartbeat_reason: Optional[str] = None
    heartbeat_age_s: Optional[float] = None
    order_check: bool = False
    live_execution_blocked: bool = True
    timestamp: str