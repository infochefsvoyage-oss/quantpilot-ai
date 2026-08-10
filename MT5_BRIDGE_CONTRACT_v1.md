# QuantPilot MT5 Bridge Contract v1

**Stand:** 2026-08-10
**Scope:** REST-Vertrag zwischen QuantPilot Frontend und der externen FastAPI MT5-Bridge (Vantage / MetaTrader 5).
**Grundsatz:** MT5 ist keine Exchange. Strategie, Risk und Governance bleiben bei QuantPilot. Die Bridge ist ein **Read/Execution-Adapter** mit technisch gesperrtem Live-Pfad.

```
QuantPilot Frontend
      │
      ▼
FastAPI MT5 Bridge
      │
      ├── MT5 Terminal / MetaTrader 5
      │       └── VantageMarkets-Live
      ├── Account Read
      ├── Symbol/Tick Read
      ├── Position Read
      ├── EA Heartbeat
      └── Execution API
              └── 🔒 /orders/execute zunächst BLOCKED
```

---

## 1. Security & Authentifizierung

- Keine MT5-Credentials im Frontend, Code oder Base44-Datenbank.
- MT5-Login/Passwort liegen ausschließlich im Secret-Manager / `.env` der FastAPI-Bridge.
- QuantPilot ↔ Bridge Authentifizierung über internen Service-Token (Header `X-QuantPilot-Token`), nicht über MT5-Credentials.
- Jede Bridge-Antwort enthält keinen Secret-Inhalt (keine Passwörter, keine API-Keys).
- Alle Aktionen werden im AuditLog protokolliert (`mt5AuditEvents`).

---

## 2. Phasen

| Phase | Key | Bedeutung |
|------|-----|-----------|
| Phase 1 | `READ_ONLY` | Verbindung, Account, XAUUSD, Markt-/Kontodaten, Heartbeat |
| Phase 2 | `PAPER_SHADOW` | QuantPilot erzeugt Signale, MT5 nimmt keine echten Orders an |
| Phase 3 | `ORDER_VALIDATION` | Entry/SL/TP/Lot/Contract/Lot-Step/Margin gegen MT5 geprüft |
| Phase 4 | `LIVE_EXECUTE` | Live-Order – erst wenn ULF + Risk + Governance + Duplicate + Emergency Stop alle grün |

Default: `READ_ONLY`, `live_execution_blocked = true`.

---

## 3. REST-Endpunkte

### 3.1 Health & Verbindung

#### `GET /health`
Bridge-Healthcheck.
**Response 200:**
```json
{ "status": "ok", "version": "v1", "mt5_terminal": "running", "uptime_seconds": 1234 }
```

#### `GET /mt5/status`
Spiegelt den `MT5Connection`-Zustand.
**Response 200:**
```json
{
  "broker": "VANTAGE", "platform": "MT5", "integration": "METAQUOTES",
  "login_status": "LOGGED_IN", "connection_status": "DATA_ONLY",
  "execution_mode": "READ_ONLY", "ea_status": "CONNECTED",
  "live_execution_blocked": true, "phase": "READ_ONLY",
  "last_heartbeat": "2026-08-10T12:00:00Z",
  "last_market_sync": "2026-08-10T12:00:01Z",
  "last_account_sync": "2026-08-10T12:00:02Z"
}
```

#### `POST /mt5/connect`
Read-only Login ins MT5-Terminal.
**Request:** `{ "server": "VantageMarkets-Live" }` (Credentials aus Secret-Store, nicht im Body)
**Response 200:** `{ "login_status": "LOGGED_IN", "connection_status": "DATA_ONLY" }`
**Response 401:** `{ "error": "AUTH_FAILED" }`

#### `POST /mt5/disconnect`
Trennt die MT5-Verbindung. Bestehende Positionen werden nicht geschlossen.
**Response 200:** `{ "connection_status": "DISCONNECTED" }`

---

### 3.2 Read-Only Daten (Phase 1)

#### `GET /account`
**Response 200:**
```json
{
  "account_id": "33882479", "balance": 0, "equity": 0, "free_margin": 0,
  "currency": "USD", "leverage": 100, "server": "VantageMarkets-Live"
}
```
> Numerische Werte werden vom Backend geliefert. Das Frontend gibt keine Mock-Werte als Live-Daten aus.

#### `GET /symbols/{canonical}`
z.B. `/symbols/XAUUSD`.
**Response 200:**
```json
{
  "canonical": "XAUUSD", "resolved": "XAUUSD", "validated": true,
  "bid": 0, "ask": 0, "spread": 0, "tick_size": 0.01, "tick_value": 1,
  "contract_size": 100, "min_lot": 0.01, "max_lot": 100, "lot_step": 0.01,
  "stop_level": 0
}
```

#### `GET /positions`
**Response 200:**
```json
{ "positions": [ { "ticket": 0, "symbol": "XAUUSD", "side": "LONG", "volume": 0, "open_price": 0, "sl": 0, "tp": 0 } ] }
```

#### `GET /ea/heartbeat`
**Response 200:**
```json
{ "ea_status": "CONNECTED", "last_heartbeat": "2026-08-10T12:00:00Z", "age_seconds": 3, "timeout_seconds": 30, "healthy": true }
```
Bei `age_seconds > timeout_seconds` → `ea_status = HEARTBEAT_LOST`, `healthy = false` → Live blockiert.

---

### 3.3 Order Validation (Phase 3)

#### `POST /orders/validate`
Prüft Entry/SL/TP/Lot/Contract/Lot-Step/Margin gegen MT5/Broker-Regeln. **Sendet keine Order.**
**Request:**
```json
{
  "signal_id": "sig_001", "canonical": "XAUUSD", "side": "LONG",
  "entry": 2000.00, "stop_loss": 1990.00, "take_profit": 2030.00,
  "lot": 0.01, "magic_number": 777077, "client_order_id": "qp_001"
}
```
**Response 200:**
```json
{
  "valid": true, "resolved_symbol": "XAUUSD",
  "checks": {
    "lot_in_range": true, "lot_step_ok": true, "sl_distance_ok": true,
    "tp_distance_ok": true, "margin_sufficient": true, "stop_level_ok": true
  },
  "required_margin": 0, "contract_size": 100
}
```
**Response 422:** `{ "valid": false, "checks": { ... }, "errors": ["lot_step_ok"] }`

---

### 3.4 Order Execution (Phase 4) – GESPERRT

#### `POST /orders/execute`
**Technisch gesperrt** bis `phase = LIVE_EXECUTE` UND alle 8 Gates grün.

Gates:
1. `data_fresh` – Market-Data frisch
2. `heartbeat_ok` – EA Heartbeat stabil
3. `account_synced` – Account synchronisiert
4. `symbol_mapped` – Symbol Mapping validiert
5. `risk_approved` – Risk Engine freigegeben
6. `governance_approved` – Governance freigegeben (gültiger action_hash)
7. `duplicate_clear` – kein Duplikat (signal_id / client_order_id / magic_number)
8. `emergency_stop_clear` – kein Emergency Stop

**Request:** wie `/orders/validate` plus `governance_action_hash`.
**Response 423 (Locked):**
```json
{ "error": "EXECUTE_BLOCKED", "reason": "GATES_NOT_GREEN", "gates": { "risk_approved": false, "governance_approved": false } }
```
**Response 200 (nur nach Freigabe):**
```json
{ "order_sent": true, "ticket": 0, "client_order_id": "qp_001", "magic_number": 777077 }
```

Block-Gründe (jeder führt zu 423):
- `live_execution_blocked = true`
- `phase != LIVE_EXECUTE`
- `risk_approved = false`
- `governance_approved = false` / ungültiger `action_hash`
- `duplicate_clear = false`
- `emergency_stop_clear = false`
- `heartbeat_ok = false` / `data_fresh = false`

---

## 4. Duplicate Protection

- `signal_id`, `client_order_id`, `magic_number` bilden den Duplikat-Key.
- Bridge lehnt doppelte `/orders/execute` mit gleicher `client_order_id` ab → 409 `DUPLICATE_ORDER`.

---

## 5. Emergency Stop

- `POST /mt5/emergency-stop` (oder Kill-Switch im Frontend) setzt `emergency_stop_clear = false`.
- Wirkung: keine neuen Orders, EA blockiert, Status geloggt, Governance-Event erzeugt.
- Bestehende Positionen werden **nicht ungefragt geschlossen**.

---

## 6. Audit-Ereignisse

`SIGNAL_CREATED`, `RISK_APPROVED`, `GOVERNANCE_APPROVED`, `EA_ORDER_SENT`, `EA_ORDER_ACCEPTED`, `EA_ORDER_REJECTED`, `POSITION_OPENED`, `POSITION_MODIFIED`, `POSITION_CLOSED`, `EMERGENCY_STOP`.

---

## 7. Fehlercodes

| Code | Bedeutung |
|------|-----------|
| 401 | `AUTH_FAILED` – MT5-Login fehlgeschlagen |
| 409 | `DUPLICATE_ORDER` – Duplikat erkannt |
| 422 | `VALIDATION_FAILED` – Order-Validierung fehlgeschlagen |
| 423 | `EXECUTE_BLOCKED` – Gates/Phase/Emergency blockieren |
| 503 | `MT5_UNAVAILABLE` – Terminal nicht erreichbar |

---

## 8. Go-Live Bedingung

`/orders/execute` bleibt gesperrt, bis:
- ✓ MT5 Read-only Test
- ✓ Symbol Mapping validiert (XAUUSD)
- ✓ EA Heartbeat stabil
- ✓ Market Feed stabil
- ✓ Account Sync stabil
- ✓ Paper Trading (Phase 2)
- ✓ Order Validation (Phase 3)
- ✓ 24h Shadow
- ✓ Risk Test, Governance Test, Emergency Stop Test, Duplicate Order Test

Erst danach: `phase = LIVE_EXECUTE`, `live_execution_blocked = false` – erneut GO-LIVE TEST.