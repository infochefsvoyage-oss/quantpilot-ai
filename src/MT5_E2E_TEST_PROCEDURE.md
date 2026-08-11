# QuantPilot MT5 Bridge – E2E-Live-Test-Prozedur

**Stand:** 2026-08-11
**Ziel:** Beweisen, dass die Kette `QuantPilot → FastAPI → MetaTrader5 Python API → laufendes MT5-Terminal → VantageMarkets-Live` tatsächlich antwortet.
**Ausführungsort:** Auf dem Rechner, auf dem MT5/Vantage läuft. **Nicht** in der Base44-App.

---

## 0. Voraussetzung
- MetaTrader 5 Terminal installiert und **laufen** (VantageMarkets-Live, Account 33882479).
- Python 3.11+ mit `MetaTrader5`, `fastapi`, `uvicorn`, `pydantic`.
- Bridge-Repo (extern): `mt5_bridge.py` mit Contract v1 (`/api/v1/mt5/*`).
- Service-Token + MT5-Credentials ausschließlich in `.env` des Backends.

---

## 1. Drei-Stufen-Verifikationsmodell
| Stufe | Bedeutung | Anzeige im Dashboard |
|------|----------|----------|
| `UI_CONTRACT` | Nur Vertrag/UI, keine Bridge, kein Terminal | rot |
| `BACKEND_CONNECTED` | FastAPI erreichbar, MT5-Terminal nicht bewiesen | gelb |
| `MT5_E2E_CONNECTED` | FastAPI → MT5 → Vantage bewiesen (alle 10 Checks pass) | grün |

**Nur `MT5_E2E_CONNECTED` darf als echte Verbindung gelten.**
Aktuell ist die App verbindungslos bei `UI_CONTRACT`.

---

## 2. Die 10 E2E-Prüfungen
| # | Check | MT5-Aufruf |
|---|-------|-----------|
| 1 | FastAPI erreichbar | `GET /api/v1/mt5/health` |
| 2 | MT5 initialize | `mt5.initialize()` |
| 3 | Terminal-Info | `mt5.terminal_info()` |
| 4 | Account-Info | `mt5.account_info()` |
| 5 | Symbol-Info | `mt5.symbol_info("XAUUSD")` |
| 6 | Symbol-Tick | `mt5.symbol_info_tick("XAUUSD")` |
| 7 | Positionen | `mt5.positions_get()` |
| 8 | EA Heartbeat | `POST /api/v1/mt5/heartbeat` (< 10s) |
| 9 | Broker-/Servername stimmt | `terminal_info.company == "Vantage"` / `account_info.server == "VantageMarkets-Live"` |
| 10 | Execution bleibt BLOCKED | `POST /api/v1/mt5/orders/execute` → `BLOCKED` |

Besonders beweiskräftig: **4, 5, 6** (`account_info`, `symbol_info`, `symbol_info_tick`) – nur diese zeigen, dass MT5 → Vantage wirklich funktioniert.

---

## 3. Test-Skript (extern auszuführen)
```python
# e2e_probe.py – auf dem MT5-Rechner ausführen
import os, json, requests, MetaTrader5 as mt5, time

BASE = os.getenv("MT5_BRIDGE_URL", "http://127.0.0.1:8000/api/v1/mt5")
EXPECTED_SERVER = "VantageMarkets-Live"
EXPECTED_COMPANY = "Vantage"

results = []
def check(num, name, ok, detail=""):
    results.append({"n": num, "name": name, "pass": bool(ok), "detail": detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {num} {name} {detail}")

# [1] FastAPI
try:
    h = requests.get(f"{BASE}/health", timeout=5).json()
    check(1, "FastAPI erreichbar", h.get("status") == "ok", h)
except Exception as e:
    check(1, "FastAPI erreichbar", False, str(e)); raise SystemExit

# [2] MT5 initialize
check(2, "MT5 initialize()", mt5.initialize())
# [3] terminal_info
ti = mt5.terminal_info(); check(3, "MT5 terminal_info()", ti is not None)
# [4] account_info
ai = mt5.account_info(); check(4, "MT5 account_info()", ai is not None, str(ai) if ai else "")
# [5] symbol_info
si = mt5.symbol_info("XAUUSD"); check(5, "MT5 symbol_info('XAUUSD')", si is not None)
# [6] symbol_info_tick
tk = mt5.symbol_info_tick("XAUUSD"); check(6, "MT5 symbol_info_tick('XAUUSD')", tk is not None)
# [7] positions_get
pos = mt5.positions_get(); check(7, "MT5 positions_get()", pos is not None, f"count={len(pos) if pos else 0}")
# [8] EA heartbeat
hb = requests.post(f"{BASE}/heartbeat", json={"ea_id":"QUANTPILOT_MT5_EA","version":"1.0.0","account":"33882479","symbols":["XAUUSD"],"timestamp":time.time()}).json()
check(8, "EA Heartbeat", hb.get("state") == "HEALTHY")
# [9] Broker/Server
check(9, "Broker/Servername stimmt",
      ti and ti.company == EXPECTED_COMPANY and ai and ai.server == EXPECTED_SERVER,
      f"{getattr(ti,'company','?')} / {getattr(ai,'server','?')}")
# [10] Execution BLOCKED
ex = requests.post(f"{BASE}/orders/execute", json={"signal_id":"E2E_PROBE","symbol":"XAUUSD","side":"BUY","volume":0.01}).json()
check(10, "Execution bleibt BLOCKED", ex.get("execution") == "BLOCKED", ex)

mt5.shutdown()
all_pass = all(r["pass"] for r in results)
print("\nVERDICT:", "MT5_E2E_CONNECTED" if all_pass else "NOT_E2E")
print(json.dumps(results, indent=2, default=str))
```

---

## 4. Erwartete Log-Ausgabe (Beispiel für grünen E2E)
```
[PASS] 1 FastAPI erreichbar {...}
[PASS] 2 MT5 initialize() ...
[PASS] 3 MT5 terminal_info() ...
[PASS] 4 MT5 account_info() ...
[PASS] 5 MT5 symbol_info('XAUUSD') ...
[PASS] 6 MT5 symbol_info_tick('XAUUSD') ...
[PASS] 7 MT5 positions_get() count=0
[PASS] 8 EA Heartbeat
[PASS] 9 Broker/Servername stimmt Vantage / VantageMarkets-Live
[PASS] 10 Execution bleibt BLOCKED {...}

VERDICT: MT5_E2E_CONNECTED
```

---

## 5. Status-Übergang im Frontend
Sobald das Backend die 10 Checks bestätigt, liefert `/api/v1/mt5/connection`:
```json
{ "connected": true, "verification_tier": "MT5_E2E_CONNECTED", "execution": "BLOCKED", "live_execution_blocked": true }
```
Erst dann darf das Dashboard `LIVE CONNECTED` anzeigen – und **trotzdem** bleibt `execution = BLOCKED` bis Phase D + alle Governance-Gates grün sind.