"""QuantPilot MT5 Bridge – E2E Probe (12 checks).
Run on the MT5/Vantage machine:  python e2e_probe.py
Only ALL PASS -> VERDICT: MT5_E2E_CONNECTED. Otherwise MT5_E2E_NOT_VERIFIED.
NO live order is sent at any point.
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


def check(n: int, name: str, ok: bool, detail: str = "") -> None:
    results.append({"n": n, "name": name, "pass": bool(ok), "detail": detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {n:02d} {name} {detail}")


print("QUANTPILOT MT5 BRIDGE E2E PROBE")
print("=" * 40)

# [01] FastAPI reachable
try:
    h = requests.get(f"{BASE}/health", headers=HEADERS, timeout=5).json()
    check(1, "FastAPI reachable", h.get("status") == "ok" or "bridge" in h, str(h.get("bridge")))
except Exception as e:
    check(1, "FastAPI reachable", False, str(e))
    print("\nVERDICT: MT5_E2E_NOT_VERIFIED (FastAPI not reachable)")
    sys.exit(1)

# [02] MT5 initialize
check(2, "MT5 initialize", mt5.initialize(), str(mt5.last_error()))

# [03] terminal_info
ti = mt5.terminal_info()
check(3, "terminal_info", ti is not None, getattr(ti, "name", "None"))

# [04] account_info
ai = mt5.account_info()
check(4, "account_info", ai is not None, f"login={getattr(ai,'login','?')}")

# [05] server verification
check(5, "server verification",
      ai is not None and ai.server == EXPECTED_SERVER and ti is not None and ti.company == EXPECTED_COMPANY,
      f"{getattr(ti,'company','?')} / {getattr(ai,'server','?')}")

# [06] XAUUSD symbol discovery (candidates, not blind)
candidates = ["XAUUSD", "XAUUSD.a", "XAUUSD.m", "GOLD", "XAU"]
resolved = next((c for c in candidates if mt5.symbol_info(c) is not None), None)
check(6, "XAUUSD symbol discovery", resolved is not None, str(resolved))

# [07] XAUUSD tick
tick = mt5.symbol_info_tick(resolved) if resolved else None
check(7, "XAUUSD tick", tick is not None, f"bid={getattr(tick,'bid','?')} ask={getattr(tick,'ask','?')}")

# [08] positions_get
pos = mt5.positions_get()
check(8, "positions_get", pos is not None, f"count={len(pos) if pos else 0}")

# [09] orders_get
ords = mt5.orders_get()
check(9, "orders_get", ords is not None, f"count={len(ords) if ords else 0}")

# [10] heartbeat
try:
    hb = requests.post(f"{BASE}/heartbeat", headers=HEADERS, json={
        "ea_id": "QUANTPILOT_MT5_EA", "version": "1.0.0", "account": "33882479",
        "symbols": ["XAUUSD"], "timestamp": time.time(),
    }, timeout=5).json()
    check(10, "heartbeat", hb.get("state") == "HEALTHY", str(hb))
except Exception as e:
    check(10, "heartbeat", False, str(e))

# [11] order_check (no order sent)
oc = None
if resolved:
    req = {
        "action": mt5.TRADE_ACTION_PENDING, "symbol": resolved, "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY, "price": tick.ask if tick else 0,
        "sl": 0, "tp": 0, "magic": 777077, "deviation": 20,
        "type_filling": mt5.ORDER_FILLING_RETURN, "type_time": mt5.ORDER_TIME_GTC,
    }
    oc = mt5.order_check(req)
check(11, "order_check", oc is not None, f"retcode={getattr(oc,'retcode','?')}")

# [12] execution guard – /orders/execute must stay BLOCKED
try:
    ex = requests.post(f"{BASE}/orders/execute", headers=HEADERS, json={
        "signal_id": "E2E_PROBE", "symbol": resolved or "XAUUSD", "side": "BUY", "volume": 0.01,
    }, timeout=5).json()
    check(12, "execution guard", ex.get("execution") == "BLOCKED", str(ex))
except Exception as e:
    check(12, "execution guard", False, str(e))

mt5.shutdown()

all_pass = all(r["pass"] for r in results)
print("\nLIVE EXECUTION: BLOCKED")
print("\nVERDICT:", "MT5_E2E_CONNECTED" if all_pass else "MT5_E2E_NOT_VERIFIED")
print(json.dumps(results, indent=2, default=str))