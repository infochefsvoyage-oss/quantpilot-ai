# QuantPilot MT5 Bridge v1

**Stand:** 2026-08-10
**Scope:** REST-Vertrag zwischen QuantPilot (ASCAN) und der externen FastAPI MT5-Bridge (Vantage / MetaTrader 5).
**Realität:** Bridge + MT5-Terminal sind **extern** und nicht Teil der Base44-App. Dieses Dokument definiert den Vertrag; es stellt **keine** echte Verbindung her.

---

## 1. Architektur

```
ASCAN / QuantPilot
        │  REST / JSON
        ▼
┌──────────────────────────┐
│ QuantPilot MT5 Bridge    │
│ FastAPI                  │
├──────────────────────────┤
│ Auth / Secret Layer       │
│ Connection Manager       │
│ Account Service          │
│ Market Data Service      │
│ Position Service         │
│ Symbol Mapper            │
│ EA Heartbeat             │
│ Risk Validator           │
│ Order Validator          │
│ Execution Guard          │
└─────────────┬────────────┘
              │
              ▼
       MetaTrader 5
              │
              ▼
      Vantage Markets
```

**Grundregel:** Das Frontend spricht niemals direkt mit MT5. MT5-Credentials bleiben ausschließlich im Backend/Secret-Store.

---

## 2. API Contract

Base-Pfad: `/api/v1/mt5`

### Health
`GET /api/v1/mt5/health`
```json
{ "status": "ok", "broker": "Vantage", "platform": "MetaTrader 5", "connection": "DATA_ONLY", "execution": "BLOCKED", "timestamp": "..." }
```

### Connection
`GET /api/v1/mt5/connection`
```json
{ "connected": true, "login": true, "server": "VantageMarkets-Live", "execution_mode": "READ_ONLY", "live_execution_blocked": true }
```
Kein Passwort in Response.

---

## 3. Account
`GET /api/v1/mt5/account`
```json
{ "connected": true, "account": { "login": "********", "balance": 0, "equity": 0, "free_margin": 0, "margin": 0, "currency": "USD" } }
```
Echte Werte werden ausschließlich zur Laufzeit vom MT5-Terminal gelesen.

---

## 4. Symbol
`GET /api/v1/mt5/symbols/XAUUSD`
```json
{
  "canonical": "XAUUSD", "resolved": "XAUUSD", "visible": true, "trade_allowed": true,
  "bid": 0, "ask": 0, "spread": 0, "tick_size": 0, "tick_value": 0,
  "contract_size": 0, "volume_min": 0, "volume_max": 0, "volume_step": 0,
  "stops_level": 0, "freeze_level": 0
}
```
ASCAN verwendet die echten Vantage-Spezifikationen, statt Brokerwerte anzunehmen.

---

## 5. EA Heartbeat
`POST /api/v1/mt5/heartbeat`
```json
{ "ea_id": "QUANTPILOT_MT5_EA", "version": "1.0.0", "account": "********", "symbols": ["XAUUSD", "BTCUSD"], "timestamp": "..." }
```
Status-Schwellen:
- `< 10s` → `HEALTHY`
- `10–30s` → `WARNING`
- `> 30s` → `STALE` → `EXECUTION = BLOCKED`

---

## 6. Positionen
`GET /api/v1/mt5/positions`
```json
{ "positions": [ { "ticket": 0, "symbol": "XAUUSD", "side": "BUY", "volume": 0, "entry": 0, "sl": 0, "tp": 0, "profit": 0 } ] }
```
Wichtig für den ASCAN-Duplicate-Guard.

---

## 7. Order Validation
`POST /api/v1/mt5/orders/validate`
Request:
```json
{ "symbol": "XAUUSD", "side": "BUY", "volume": 0.01, "entry": 0, "stop_loss": 0, "take_profit": 0, "strategy": "ASCAN_ICT_SNIPER", "signal_id": "ASCAN-..." }
```
Bridge prüft: MT5 verbunden · Account synchronisiert · Symbol vorhanden · handelbar · Bid/Ask verfügbar · Volume gültig · Lot-Step gültig · SL gültig · TP gültig · Margin ausreichend · Spread akzeptabel · Duplicate · Risk · Governance · Emergency Stop · EA Heartbeat.
Response:
```json
{ "valid": false, "execution": "BLOCKED", "reasons": ["GOVERNANCE_NOT_APPROVED"] }
```
Es wird **keine Order** an MT5 gesendet.

---

## 8. Execution Guard
```
if not connection.connected:    → BLOCKED
if not heartbeat.healthy:      → BLOCKED
if not risk.approved:           → BLOCKED
if not governance.approved:     → BLOCKED
if emergency_stop:             → BLOCKED
if duplicate_detected:         → BLOCKED
if not order_validation.valid: → BLOCKED
if not live_execution_enabled: → BLOCKED
erst dann: EXECUTION_ALLOWED
```

---

## 9. /orders/execute bleibt zunächst gesperrt
`POST /api/v1/mt5/orders/execute`
```json
{ "execution": "BLOCKED", "reason": "LIVE_EXECUTION_DISABLED" }
```
Endpoint existiert, damit die komplette Pipeline getestet werden kann – ohne versehentliche Echtgeldorder.

---

## 10. ASCAN → MT5
```
ASCAN Signal Engine → ICT/Sniper Signal → Final Execution Decision
  ├── NO_TRADE
  ├── WATCH_ONLY
  ├── ENTER_REDUCED
  └── ENTER → MT5 Order Validator
              ├── BLOCKED → Log
              └── VALID   → Execution Guard → MT5 / Vantage
```
ASCAN-Logik wird nicht ersetzt, sondern um MT5 als Execution-Adapter erweitert.

---

## 11. Governance-Gates

| Gate | Read Only | Shadow | Live |
|------|:---:|:---:|:---:|
| MT5 Connected | ✅ | ✅ | ✅ |
| Account Sync | ✅ | ✅ | ✅ |
| Symbol Mapping | ✅ | ✅ | ✅ |
| Market Data | ✅ | ✅ | ✅ |
| EA Heartbeat | ✅ | ✅ | ✅ |
| Risk Engine | — | ✅ | ✅ |
| Duplicate Guard | — | ✅ | ✅ |
| ULF Governance | — | ✅ | ✅ |
| Emergency Stop | — | ✅ | ✅ |
| Order Validation | — | ✅ | ✅ |
| Live Execution | 🔒 | 🔒 | später |

---

## 12. Phasen
- 🟢 **Phase A – jetzt:** MT5 `DATA_ONLY` – nur lesen.
- 🟡 **Phase B – Shadow:** QuantPilot berechnet ENTRY/SL/TP/LOT/RR/RISK, aber `MT5 ORDER = 0`.
- 🟠 **Phase C – Order Validation:** echte Brokerbedingungen prüfen (Mindestlot, Lot-Step, Contract, Tick-Value, Margin, Spread, Stop-/Freeze-Level, Trading-Hours), `EXECUTE = BLOCKED`.
- 🔴 **Phase D – Live:** erst nach expliziter Freigabe + grünen Governance-Gates.

---

## 13. XAUUSD (ICT-Sniper)
Keine statischen Vantage-Werte. Bridge liefert jedes Mal die echten MT5-Spezifikationen:
`Bid · Ask · Spread · Tick Size · Tick Value · Contract Size · Volume Min/Max/Step · Stops Level · Freeze Level`.
Daraus berechnet QuantPilot die tatsächliche Positionsgröße.

---

## 14. Sicherheitsstatus (Zielzustand – Vertrag definiert, nicht live)
```
╔══════════════════════════════════════╗
║       QUANTPILOT MT5 BRIDGE v1       ║
╠══════════════════════════════════════╣
║ Vantage MT5       CONNECTED          ║
║ Account           SYNCED             ║
║ XAUUSD            VALIDATED          ║
║ Market Data       AVAILABLE          ║
║ EA Heartbeat      HEALTHY            ║
║ Execution         🔒 BLOCKED          ║
║ Risk Gate         NOT ARMED          ║
║ Governance        NOT ARMED          ║
║ Live Trading      DISABLED           ║
╚══════════════════════════════════════╝
```

---

## 15. Nächster Implementierungsschritt (extern)
`mt5_bridge.py` + Pydantic-Schemas + `/health`, `/connection`, `/account`, `/symbols/{symbol}`, `/positions`, `/heartbeat`, `/orders/validate`. Danach Bridge gegen laufendes MT5-Terminal testen – ohne eine echte Order.