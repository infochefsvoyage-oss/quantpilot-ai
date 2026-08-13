"""FastAPI app – auth, routers, structured error mapping (section 16)."""
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from .config import settings
from .logging_config import configure_logging, log
from .schemas import BridgeError
from .mt5_client import now_iso
from .routes import health, connection, account, symbols, positions, heartbeat, orders, verification

configure_logging()
app = FastAPI(title="QuantPilot MT5 Bridge", version="1.3.0")

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(key: str = Depends(_api_key_header)) -> str:
    if settings.bridge_api_key and settings.bridge_api_key != "change-me":
        if key != settings.bridge_api_key:
            raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    return key


@app.middleware("http")
async def log_requests(request: Request, call_next):
    log.info("request", path=request.url.path, method=request.method)
    resp = await call_next(request)
    log.info("response", path=request.url.path, status=resp.status_code)
    return resp


@app.exception_handler(BridgeError)
async def bridge_error_handler(_request: Request, exc: BridgeError):
    log.error("bridge_error", code=exc.code, stage=exc.stage, detail=exc.detail)
    return JSONResponse(
        status_code=exc.status,
        content={
            "ok": False,
            "stage": exc.stage or "unknown",
            "error_code": exc.code,
            "error_message": exc.detail,
            "timestamp": now_iso(),
        },
    )


_AUTH = [Depends(verify_api_key)]
app.include_router(health.router, prefix="/api/v1/mt5", tags=["health"])
app.include_router(verification.router, prefix="/api/v1/mt5", tags=["verification"], dependencies=_AUTH)
app.include_router(connection.router, prefix="/api/v1/mt5", tags=["connection"], dependencies=_AUTH)
app.include_router(account.router, prefix="/api/v1/mt5", tags=["account"], dependencies=_AUTH)
app.include_router(symbols.router, prefix="/api/v1/mt5", tags=["symbols"], dependencies=_AUTH)
app.include_router(positions.router, prefix="/api/v1/mt5", tags=["positions"], dependencies=_AUTH)
app.include_router(heartbeat.router, prefix="/api/v1/mt5", tags=["heartbeat"], dependencies=_AUTH)
app.include_router(orders.router, prefix="/api/v1/mt5", tags=["orders"], dependencies=_AUTH)


@app.get("/")
def root():
    return {"name": "quantpilot-mt5-bridge", "version": "1.3.0", "execution": "BLOCKED"}