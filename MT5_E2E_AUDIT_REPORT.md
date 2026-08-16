# MT5 E2E Verification Audit Report

**Audit-Datum:** 2026-08-16
**Auditor:** QuantPilot AI – Audit Layer
**Audit-Trigger:** UI behauptete `MT5_E2E_CONNECTED` / 12-12 PASS — Verdacht auf unberechtigten Status.

---

## 1. EVIDENCE_SOURCE

| Feld | Wert |
|---|---|
| Probe-Skript | `quantpilot-mt5-bridge/e2e_probe.py` (14 Checks) |
| Probe-Output | `quantpilot-mt5-bridge/e2e_probe_output.txt` |
| UI-Datensatz | `MT5Connection` Entity (DB), id `6a82159bb76e631992a72b8f` |
| UI-Vertrag | `src/lib/mt5Data.js` (e2eTestChecks) |

**Befund:** Der UI-Datensatz (`verification_tier: MT5_E2E_CONNECTED`) stand im **Widerspruch** zum echten Probe-Output (`VERDICT: MT5_E2E_NOT_VERIFIED`). Der UI-Status war nicht aus echter E2E-Evidenz abgeleitet, sondern aus einem DB-Eintrag ohne bewiesenen Probe-Lauf.

---

## 2. PROBE_VERSION

- **Version:** 14-Check-Probe (`e2e_probe.py`, Header: `QUANTPILOT MT5 BRIDGE E2E PROBE (14 CHECKS)`)
- **Konflikt erkannt:** UI-Vertrag (`mt5Data.js`) definierte bisher **12** Checks — abweichend von der echten 14-Check-Probe.
- **Behebung:** UI-Vertrag auf 14 Checks reconciled (identisch zu `e2e_probe.py`). Es existiert jetzt **nur noch ein einziger E2E-Vertrag** (14 Checks).

---

## 3. PROBE_TIMESTAMP

- **Timestamp (Output):** `2026-08-16T10:27:28Z` (UTC) — alle Checks tragen diesen Zeitstempel.
- **Host-Zeit (Audit):** `2026-08-16T20:02Z` (UTC)
- **Latenz:** Probe-Output ist ~9,5 h alt zum Audit-Zeitpunkt.

---

## 4. HOST_TYPE

- **Befund:** Der Probe-Lauf erfolgte **NICHT** auf einem Windows/MT5-Host.
- **Evidence:** Output-Zeile 3: `WARNING: MetaTrader5 package not available -> ModuleNotFoundError: No module named 'MetaTrader5'`
- **Schluss:** Der Host hat kein installiertes `MetaTrader5` Python-Paket → kein echter MT5-Terminal-Zugriff möglich. Wahrscheinlich Linux/macOS oder Windows ohne MT5-Terminal.

---

## 5. MT5_PACKAGE

- **Status:** `NOT INSTALLED`
- **Fehler:** `ModuleNotFoundError: No module named 'MetaTrader5'`
- **Bedeutung:** Kein einziger MT5-API-Aufruf konnte ausgeführt werden. Alle MT5-abhängigen Checks wurden mit `MT5_TERMINAL_UNAVAILABLE` als FAIL aufgezeichnet.

---

## 6. MT5_TERMINAL

- **Status:** `NOT PROVEN` — kein `mt5.initialize()`, kein `mt5.terminal_info()` erfolgreich.
- **Broker Company:** `n/a` (nicht ermittelbar)
- **Trade Allowed:** `n/a` (nicht ermittelbar)

---

## 7. VANTAGE_SERVER

- **Status:** `NOT PROVEN` — `mt5.account_info()` nicht ausgeführt.
- **Server im Output:** `n/a` (Diagnoseblock: `SERVER: n/a`)
- **Server im UI-Datensatz:** `VantageMarkets-Live 14` — **nicht durch Probe bewiesen**, nur ein Referenzwert.

---

## 8. ACCOUNT_LOGIN_MASKED

- **Status:** `****` (Diagnoseblock: `LOGIN: ****`)
- **Bedeutung:** Kein echtes Login ermittelbar, da `account_info()` nicht ausgeführt wurde. Maske ist korrekt (kein Secret-Leak), aber ohne Evidenz.

---

## 9. CHECK_COUNT

- **Gesamt:** 14 Checks (laut `e2e_probe.py` und Output)

---

## 10. PASS_COUNT / FAIL_COUNT

| # | Check | Status |
|---|---|---|
| 01 | Bridge Health | **PASS** (8ms) |
| 02 | MT5 Initialize | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 03 | Terminal erreichbar | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 04 | Account erkannt | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 05 | Server erkannt | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 06 | Balance | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 07 | Equity | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 08 | Free Margin | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 09 | XAUUSD Symbol Discovery | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 10 | Tick | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 11 | Positions | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 12 | Orders | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |
| 13 | Heartbeat | **PASS** (10ms) |
| 14 | order_check | **FAIL** (MT5_TERMINAL_UNAVAILABLE) |

- **PASS_COUNT:** 2 (Bridge Health, Heartbeat)
- **FAIL_COUNT:** 12

---

## 11. ORDER_CHECK

- **Status:** `NICHT MOEGLICH` (MetaTrader5 nicht installiert)
- **Output:** `ORDER_CHECK = NICHT MOEGLICH (MetaTrader5 nicht installiert)`
- **Bedeutung:** `mt5.order_check()` wurde **nicht** ausgeführt. Kein echter Pre-Trade-Validierungsbeweis.

---

## 12. ORDER_SEND

- **Status:** `BLOCKED` ✅
- **Output:** `ORDER_SEND = BLOCKED`
- **Bedeutung:** Der `/orders/execute`-Endpoint der Bridge antwortet mit `execution: BLOCKED`. Es wurde **niemals** `order_send()` ausgeführt. Kill-Switch aktiv.

---

## 13. LIVE_EXECUTION

- **Status:** `BLOCKED` ✅
- **Output:** `LIVE EXECUTION = BLOCKED`
- **Bridge-Code:** `LIVE_EXECUTION_ENABLED = false` (hard guard in `app/routes/orders.py`)
- **UI-Datensatz:** `live_execution_blocked: true` (korrekt)

---

## 14. Echte MT5-Aufrufe — Nachweis

| MT5-API-Aufruf | Ausgeführt? | Ergebnis |
|---|---|---|
| `mt5.initialize()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.terminal_info()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.account_info()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.symbol_info()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.symbol_info_tick()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.positions_get()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.orders_get()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.order_check()` | ❌ Nein | FAIL — Paket fehlt |
| `mt5.order_send()` | ❌ Nein (korrekt) | NIE ausgeführt — Kill-Switch aktiv |

**Schluss:** Kein einziger echter MT5-API-Aufruf wurde ausgeführt. Die 12 FAILs sind alle auf `MT5_TERMINAL_UNAVAILABLE` zurückzuführen.

---

## 15. FINAL_VERDICT

```
MT5_E2E_NOT_VERIFIED
```

**Begründung:**
- MetaTrader5-Paket nicht installiert → kein Terminal-Zugriff.
- 12 von 14 Checks FAIL.
- Keine echte Broker/Server/Login/Account/Symbol/Tick-Evidenz.
- `order_check` nicht ausgeführt.
- Nur Bridge-Health und Heartbeat PASS → Bridge erreichbar, aber MT5 nicht bewiesen.

**Korrekter Tier gemäß 3-Stufen-Modell:**

| Tier | Bedingung | Erfüllt? |
|---|---|---|
| `UI_CONTRACT` | Nur UI/Vertrag, keine Bridge | Nein (Bridge antwortet) |
| `BACKEND_CONNECTED` | FastAPI erreichbar, MT5 nicht bewiesen | **JA ✅** |
| `MT5_E2E_CONNECTED` | FastAPI → MT5 → Vantage bewiesen | Nein |

---

## 16. Durchgeführte Korrektur

Der `MT5Connection`-Datensatz wurde vom Audit **automatisch zurückgestuft**:

| Feld | Vorher (FALSCH) | Nachher (KORREKT) |
|---|---|---|
| `verification_tier` | `MT5_E2E_CONNECTED` | `BACKEND_CONNECTED` |
| `connection_status` | `CONNECTED` | `DISCONNECTED` |
| `login_status` | `LOGGED_IN` | `LOGGED_OUT` |
| `ea_status` | `CONNECTED` | `NOT_INSTALLED` |
| `last_heartbeat` | `2026-08-16T21:51:00Z` | `null` |
| `last_market_sync` | `2026-08-16T21:51:00Z` | `null` |
| `last_account_sync` | `2026-08-16T21:51:00Z` | `null` |
| `live_execution_blocked` | `true` | `true` (bleibt BLOCKED) |

**UI-Vertrag reconciled:** `e2eTestChecks` in `src/lib/mt5Data.js` von 12 auf 14 Checks aktualisiert — identisch zu `e2e_probe.py`. Es existiert nur noch ein E2E-Vertrag.

---

## 17. Voraussetzungen für echtes MT5_E2E_CONNECTED

Um später legitim auf `MT5_E2E_CONNECTED` hochzustufen, MUSS ein Probe-Lauf folgende Bedingungen erfüllen:

1. Ausführung auf **Windows-Host** mit installiertem `MetaTrader5` Python-Paket.
2. Geöffnetes und eingeloggetes **Vantage MT5-Terminal**.
3. Alle 14 Checks **PASS** (inkl. `mt5.initialize`, `terminal_info`, `account_info`, `symbol_info`, `symbol_info_tick`, `positions_get`, `orders_get`, `order_check`).
4. Broker Company enthält `Vantage` (Case-insensitive).
5. Server in Allowlist (`VantageMarkets-Live*`, `VantageInternational-Live*`, etc.).
6. Login maskiert (`****XXXX`), `trade_allowed` bestätigt.
7. XAUUSD (oder Kandidat) aufgelöst mit echtem Tick (bid/ask).
8. `order_send()` **niemals** ausgeführt.
9. `/orders/execute` antwortet `BLOCKED`.
10. `LIVE_EXECUTION` bleibt `BLOCKED`.

Erst wenn ein solcher Output in `e2e_probe_output.txt` vorliegt, darf der Datensatz auf `MT5_E2E_CONNECTED` gesetzt werden — und nur dann.

---

**Audit abgeschlossen. Keine Simulation. Keine Default-Werte. Keine UI-Assertion als E2E-Beweis.**