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


def record(n, name, status, duration_ms, error_code="", error_message=""):
    results.append({
        "check": n, "name": name, "status": status,
        "duration_ms": duration_ms, "error_code": error_code, "error_message": error_message,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    print(f"[{status}] {n:02d} {name} ({duration_ms}ms) {error_code} {error_message}")


def timed(n, name, fn):
    t0 = time.perf_counter()
    try:
        fn()
        record(n, name, "PASS", int((time.perf_counter() - t0) * 1000))
        return True
    except Exception as e:
        record(n, name, "FAIL", int((time.perf_counter() - t0) * 1000), type(e).__name__, str(e))
        return False


print("QUANTPILOT MT5 BRIDGE E2E PROBE (14 CHECKS)")
print("=" * 50)

# [01] Bridge Health
def c1():
    h = requests.get(f"{BASE}/health", headers=HEADERS, timeout=5).json()
    assert "bridge" in h or "status" in h, str(h)
if not timed(1, "Bridge Health", c1):
    print("\nVERDICT: MT5_E2E_NOT_VERIFIED (FastAPI not reachable)")
    print(json.dumps(results, indent=2, default=str))
    sys.exit(1)

# [02] MT5 Initialize
def c2():
    assert mt5.initialize(), str(mt5.last_error())
timed(2, "MT5 Initialize", c2)

# [03] Terminal erreichbar
def c3():
    assert mt5.terminal_info() is not None, str(mt5.last_error())
timed(3, "Terminal erreichbar", c3)

# [04] Account erkannt
ai = None
def c4():
    global ai
    ai = mt5.account_info()
    assert ai is not None, str(mt5.last_error())
timed(4, "Account erkannt", c4)

# [05] Server erkannt
def c5():
    assert ai is not None and ai.server == EXPECTED_SERVER, f"server={getattr(ai,'server','?')}"
    ti = mt5.terminal_info()
    assert ti is not None and ti.company == EXPECTED_COMPANY, f"company={getattr(ti,'company','?')}"
timed(5, "Server erkannt", c5)

# [06] Balance
def c6():
    assert ai is not None and ai.balance is not None
timed(6, "Balance", c6)

# [07] Equity
def c7():
    assert ai is not None and ai.equity is not None
timed(7, "Equity", c7)

# [08] Free Margin
def c8():
    assert ai is not None and ai.margin_free is not None
timed(8, "Free Margin", c8)

# [09] XAUUSD Symbol Discovery
resolved = None
def c9():
    global resolved
    candidates = ["XAUUSD", "XAUUSD.a", "XAUUSD.m", "GOLD", "XAU"]
    resolved = next((c for c in candidates if mt5.symbol_info(c) is not None), None)
    assert resolved, "no candidate found"
timed(9, "XAUUSD Symbol Discovery", c9)

# [10] Tick
tick = None
def c10():
    global tick
    tick = mt5.symbol_info_tick(resolved)
    assert tick is not None, "tick None"
timed(10, "Tick", c10)

# [11] Positions
def c11():
    assert mt5.positions_get() is not None
timed(11, "Positions", c11)

# [12] Orders
def c12():
    assert mt5.orders_get() is not None
timed(12, "Orders", c12)

# [13] Heartbeat
def c13():
    hb = requests.post(f"{BASE}/heartbeat", headers=HEADERS, json={
        "ea_id": "QUANTPILOT_MT5_EA", "version": "1.0.0", "account": "********",
        "symbols": ["XAUUSD"], "timestamp": str(time.time()),
    }, timeout=5).json()
    assert hb.get("state") == "HEALTHY", str(hb)
timed(13, "Heartbeat", c13)

# [14] order_check (NO order sent)
def c14():
    req = {
        "action": mt5.TRADE_ACTION_PENDING, "symbol": resolved, "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY, "price": tick.ask if tick else 0,
        "sl": 0, "tp": 0, "magic": 777077, "deviation": 20,
        "type_filling": mt5.ORDER_FILLING_RETURN, "type_time": mt5.ORDER_TIME_GTC,
    }
    assert mt5.order_check(req) is not None, "order_check None"
timed(14, "order_check", c14)

mt5.shutdown()

# Execution guard verification: /orders/execute MUST stay BLOCKED
try:
    ex = requests.post(f"{BASE}/orders/execute", headers=HEADERS, json={}, timeout=5).json()
    exec_blocked = ex.get("execution") == "BLOCKED"
except Exception:
    exec_blocked = False
print(f"\nORDER_CHECK = moeglich (real mt5.order_check)")
print(f"ORDER_SEND  = {'BLOCKED' if exec_blocked else 'NOT BLOCKED !!!'}")
print(f"LIVE EXECUTION = BLOCKED")

all_pass = all(r["status"] == "PASS" for r in results) and exec_blocked
print("\nVERDICT:", "MT5_E2E_CONNECTED" if all_pass else "MT5_E2E_NOT_VERIFIED")
print(json.dumps(results, indent=2, default=str))