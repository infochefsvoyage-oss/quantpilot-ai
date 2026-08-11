"""QuantPilot MT5 Bridge – E2E Probe (14 checks).
Run on the MT5/Vantage machine:  python e2e_probe.py
Only ALL required PASS -> VERDICT: MT5_E2E_CONNECTED. Else MT5_E2E_NOT_VERIFIED.
NO live order is sent at any point (order_check only, never order_send).
"""
from __future__ import annotations
import os
import sys
import time
import json
import requests
import MetaTrader5 as mt5

BASE = os.getenv("MT5_BRIDGE_URL", "http://127.0.0.1:8000/api/v1/mt5")
API_KEY = os.getenv("MT5_BRIDGE_API_KEY", "")
EXPECTED_COMPANY = os.getenv("EXPECTED_BROKER_COMPANY", "Vantage")
EXPECTED_SERVER = os.getenv("EXPECTED_SERVER", "VantageMarkets-Live")
HEADERS = {"X-API-Key": API_KEY} if API_KEY else {}

results: list[dict] = []


def check(n: int, name: str, status: str, error_code: str = "", error_message: str = "") -> None:
    results.append({
        "n": n, "name": name, "status": status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_ms": 0, "error_code": error_code, "error_message": error_message,
    })
    print(f"[{status}] {n:02d} {name} {error_code} {error_message}")


def timed(n, name, fn):
    t0 = time.perf_counter()
    try:
        fn()
        d = int((time.perf_counter() - t0) * 1000)
        results.append({"n": n, "name": name, "status": "PASS", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "duration_ms": d, "error_code": "", "error_message": ""})
        print(f"[PASS] {n:02d} {name} ({d}ms)")
        return True
    except Exception as e:
        d = int((time.perf_counter() - t0) * 1000)
        results.append({"n": n, "name": name, "status": "FAIL", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "duration_ms": d, "error_code": type(e).__name__, "error_message": str(e)})
        print(f"[FAIL] {n:02d} {name} ({d}ms) {type(e).__name__}: {e}")
        return False


print("QUANTPILOT MT5 BRIDGE E2E PROBE")
print("=" * 48)

# [01] Bridge Health
def c1():
    h = requests.get(f"{BASE}/health", headers=HEADERS, timeout=5).json()
    assert "bridge" in h or "status" in h, str(h)
if not timed(1, "Bridge Health", c1):
    print("\nVERDICT: MT5_E2E_NOT_VERIFIED (FastAPI not reachable)")
    sys.exit(1)

# [02] MT5 Initialize
def c2():
    assert mt5.initialize(), str(mt5.last_error())
timed(2, "MT5 Initialize", c2)

# [03] Terminal erreichbar
ti = mt5.terminal_info()
check(3, "Terminal erreichbar", "PASS" if ti is not None else "FAIL", "" if ti else "terminal_info None", "" if ti else str(mt5.last_error()))

# [04] Account erkannt
ai = mt5.account_info()
check(4, "Account erkannt", "PASS" if ai is not None else "FAIL", "" if ai else "account_info None")

# [05] Server erkannt
server_ok = ai is not None and ai.server == EXPECTED_SERVER and ti is not None and ti.company == EXPECTED_COMPANY
check(5, "Server erkannt", "PASS" if server_ok else "FAIL", "", f"{getattr(ti,'company','?')}/{getattr(ai,'server','?')}")

# [06] Balance
check(6, "Balance", "PASS" if ai is not None else "FAIL", "", str(getattr(ai, "balance", "n/a")))

# [07] Equity
check(7, "Equity", "PASS" if ai is not None else "FAIL", "", str(getattr(ai, "equity", "n/a")))

# [08] Free Margin
check(8, "Free Margin", "PASS" if ai is not None else "FAIL", "", str(getattr(ai, "margin_free", "n/a")))

# [09] XAUUSD Symbol Discovery
candidates = ["XAUUSD", "XAUUSD.a", "XAUUSD.m", "GOLD", "XAU"]
resolved = next((c for c in candidates if mt5.symbol_info(c) is not None), None)
check(9, "XAUUSD Symbol Discovery", "PASS" if resolved else "FAIL", "" if resolved else "SYMBOL_NOT_FOUND", str(resolved))

# [10] Tick
tick = mt5.symbol_info_tick(resolved) if resolved else None
check(10, "Tick", "PASS" if tick else "FAIL", "" if tick else "MARKET_DATA_UNAVAILABLE", f"bid={getattr(tick,'bid','?')}")

# [11] Positions
pos = mt5.positions_get()
check(11, "Positions", "PASS" if pos is not None else "FAIL", "", f"count={len(pos) if pos else 0}")

# [12] Orders
ords = mt5.orders_get()
check(12, "Orders", "PASS" if ords is not None else "FAIL", "", f"count={len(ords) if ords else 0}")

# [13] Heartbeat
def c13():
    hb = requests.post(f"{BASE}/heartbeat", headers=HEADERS, json={
        "ea_id": "QUANTPILOT_MT5_EA", "version": "1.0.0", "account": "33882479",
        "symbols": ["XAUUSD"], "timestamp": time.time(),
    }, timeout=5).json()
    assert hb.get("state") == "HEALTHY", str(hb)
timed(13, "Heartbeat", c13)

# [14] order_check (no order sent)
def c14():
    req = {
        "action": mt5.TRADE_ACTION_PENDING, "symbol": resolved or "XAUUSD", "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY, "price": tick.ask if tick else 0,
        "sl": 0, "tp": 0, "magic": 777077, "deviation": 20,
        "type_filling": mt5.ORDER_FILLING_RETURN, "type_time": mt5.ORDER_TIME_GTC,
    }
    oc = mt5.order_check(req)
    assert oc is not None, "order_check None"
timed(14, "order_check", c14)

mt5.shutdown()

all_pass = all(r["status"] == "PASS" for r in results)
print("\nLIVE EXECUTION: BLOCKED")
print("\nVERDICT:", "MT5_E2E_CONNECTED" if all_pass else "MT5_E2E_NOT_VERIFIED")
print(json.dumps(results, indent=2, default=str))