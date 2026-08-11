"""FastAPI app – auth, routers, error mapping (section 16)."""
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from .config import settings
from .logging_config import configure_logging, log
from .schemas import BridgeError
from .routes import health, connection, account, symbols, positions, heartbeat, orders

configure_logging()
app = FastAPI(title="QuantPilot MT5 Bridge", version="1.2.0")

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
    return resp


@app.exception_handler(BridgeError)
async def bridge_error_handler(_request: Request, exc: BridgeError):
    log.error("bridge_error", code=exc.code, detail=exc.detail)
    return JSONResponse(
        status_code=exc.status,
        content={"error": exc.code, "detail": exc.detail, "execution": "BLOCKED"},
    )


app.include_router(health.router, prefix="/api/v1/mt5", tags=["health"])
app.include_router(connection.router, prefix="/api/v1/mt5", tags=["connection"], dependencies=[Depends(verify_api_key)])
app.include_router(account.router, prefix="/api/v1/mt5", tags=["account"], dependencies=[Depends(verify_api_key)])
app.include_router(symbols.router, prefix="/api/v1/mt5", tags=["symbols"], dependencies=[Depends(verify_api_key)])
app.include_router(positions.router, prefix="/api/v1/mt5", tags=["positions"], dependencies=[Depends(verify_api_key)])
app.include_router(heartbeat.router, prefix="/api/v1/mt5", tags=["heartbeat"], dependencies=[Depends(verify_api_key)])
app.include_router(orders.router, prefix="/api/v1/mt5", tags=["orders"], dependencies=[Depends(verify_api_key)])


@app.get("/")
def root():
    return {"name": "quantpilot-mt5-bridge", "version": "1.2.0", "execution": "BLOCKED"}