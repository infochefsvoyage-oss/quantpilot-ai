# QuantPilot MT5 Bridge – E2E-Live-Test-Prozedur

**Stand:** 2026-08-16 (reconciled mit e2e_probe.py – 14 Checks)
**Ziel:** Beweisen, dass die Kette `QuantPilot → FastAPI → MetaTrader5 Python API → laufendes MT5-Terminal → VantageMarkets-Live` tatsächlich antwortet.
**Ausführungsort:** Auf dem Rechner, auf dem MT5/Vantage läuft. **Nicht** in der Base44-App.
**Kanonischer Contract:** `src/lib/mt5VerificationContract.js` (14 Checks – Single Source of Truth).

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
| `MT5_E2E_CONNECTED` | FastAPI → MT5 → Vantage bewiesen (alle 14 Checks PASS) | grün |

**Nur `MT5_E2E_CONNECTED` darf als echte Verbindung gelten.**
Ein persistierter Frontend-Datensatz (MT5Connection-Entity) ist **kein** E2E-Beweis.
Aktuell ist die App verbindungslos bei `BACKEND_CONNECTED` (Bridge antwortet, MT5 nicht bewiesen).

---

## 2. Die 14 E2E-Prüfungen (kanonisch – identisch zu `e2e_probe.py`)
| # | Check | MT5-Aufruf |
|---|-------|-----------|
| 01 | Bridge Health | `GET /api/v1/mt5/health` |
| 02 | MT5 Initialize | `mt5.initialize()` |
| 03 | Terminal erreichbar | `mt5.terminal_info()` |
| 04 | Account erkannt | `mt5.account_info()` |
| 05 | Server erkannt | `account_info.server` (Allowlist) |
| 06 | Balance | `account_info.balance` |
| 07 | Equity | `account_info.equity` |
| 08 | Free Margin | `account_info.margin_free` |
| 09 | XAUUSD Symbol Discovery | `mt5.symbol_info()` |
| 10 | Tick | `mt5.symbol_info_tick()` |
| 11 | Positions | `mt5.positions_get()` |
| 12 | Orders | `mt5.orders_get()` |
| 13 | Heartbeat | `POST /api/v1/mt5/heartbeat` (HEALTHY) |
| 14 | order_check | `mt5.order_check()` (keine Order!) |

Besonders beweiskräftig: **04, 09, 10** (`account_info`, `symbol_info`, `symbol_info_tick`) – nur diese zeigen, dass MT5 → Vantage wirklich funktioniert.
**Check 14 (`order_check`) ist KEIN ausgeführter Trade** – es ist eine Pre-Trade-Validierung. `order_send()` wird nie ausgeführt.

---

## 3. Test-Skript (extern auszuführen)
Das kanonische Probe-Skript ist `quantpilot-mt5-bridge/e2e_probe.py` (14 Checks).
**Nicht** hier duplizieren – stattdessen auf dem MT5-Rechner ausführen:
```bash
cd quantpilot-mt5-bridge
python e2e_probe.py
```
Das Skript verwendet stdlib `urllib` (kein `requests`-Dependency) und degradiert
gracefully, wenn `MetaTrader5` nicht installiert ist (alle MT5-Checks → FAIL mit
`MT5_TERMINAL_UNAVAILABLE`). Kein Check wird jemals aus Default-Werten PASS.

---

## 4. Erwartete Log-Ausgabe (Beispiel für grünen E2E – 14 Checks)
```
[PASS] 01 Bridge Health
[PASS] 02 MT5 Initialize
[PASS] 03 Terminal erreichbar
[PASS] 04 Account erkannt
[PASS] 05 Server erkannt
[PASS] 06 Balance
[PASS] 07 Equity
[PASS] 08 Free Margin
[PASS] 09 XAUUSD Symbol Discovery
[PASS] 10 Tick
[PASS] 11 Positions
[PASS] 12 Orders
[PASS] 13 Heartbeat
[PASS] 14 order_check

ORDER_CHECK = moeglich (real mt5.order_check)
ORDER_SEND  = BLOCKED
LIVE EXECUTION = BLOCKED

VERDICT: MT5_E2E_CONNECTED
```

**Aktueller echter Output (2026-08-16T10:27:28Z):** `VERDICT: MT5_E2E_NOT_VERIFIED`
(MetaTrader5 nicht installiert, 12/14 FAIL). Siehe `e2e_probe_output.txt` und
`MT5_E2E_AUDIT_REPORT.md`.

---

## 5. Status-Übergang im Frontend
Sobald die echte Probe auf dem Windows/MT5-Rechner alle 14 Checks bestätigt, liefert
`/api/v1/mt5/verification` den Tier `MT5_E2E_CONNECTED`. Erst dann darf das Dashboard
grün anzeigen – und **trotzdem** bleibt `execution = BLOCKED` bis Phase D + alle
Governance-Gates grün sind.

**Kein persistierter Frontend-Datensatz darf als E2E-Beweis gelten.** Die
`MT5Connection`-Entity spiegelt nur den zuletzt vom Backend gemeldeten Stand – sie
darf nicht aus sich selbst heraus auf `MT5_E2E_CONNECTED` gesetzt werden.