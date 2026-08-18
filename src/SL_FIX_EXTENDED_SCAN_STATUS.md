# PHASE SL-FIX — EXTENDED SCAN STATUS — ABSCHLUSSBERICHT

**Datum:** 2026-08-18 21:17 UTC (23:17 Europe/Zurich)
**Phase:** SL-FIX → Regression → Extended Scan (10–20 Tage)

**Sicherheitsgatter (unverändert):**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF

---

## 1. SL-Fix: Angewendet ✅

**Datei:** `src/lib/ictEngine.js`, `generatePaperSignal()` (Zeile 289)

- SL-Auswahl richtet sich nach Trade-Richtung, nicht nach OB-Typ
- LONG → SL < Entry (BULLISH OB low oder Sweep unter Entry)
- SHORT → SL > Entry (BEARISH OB high oder Sweep über Entry)
- Geometrie-Validierung zwingend vor Risk/RR-Berechnung
- `Math.abs()` bei Risk/RR erst nach gültiger Geometrie

**Frontend-Code — sofort aktiv.**

---

## 2. Regressionstest: PASS ✅

```
BEFORE (alte Logik):
  A_PLUS        = 18
  INVALID_SL    = 8
  VALID_A_PLUS  = 10

AFTER (korrigierte Logik):
  VALID_SL_GEOMETRY = 12
  A_PLUS            = 12
  INVALID_SL        = 0
  LONG_A_PLUS       = 5
  SHORT_A_PLUS      = 7
  ERROR_RATE        = 0
  RECONCILIATION    = 100
```

- Alle 10 previously valid Setups unverändert ✅
- 2 previously invalid Setups durch SWEEP_level Fallback rescued ✅
- 6 previously invalid Setups verworfen (kein valider SL) ✅
- Alle 12 A+: SL_GEOMETRY = VALID, RR = 2.0, FRESH, Current Structure ✅

---

## 3. Extended Scan: BLOCKED (Bridge-Neustart erforderlich)

### Bridge-Kapazität getestet

| Test | Ergebnis | Status |
|------|----------|--------|
| count=5000 | 200 OK, 5000 Candles | ✅ funktioniert |
| count=15000 | 422 Rejected | ❌ Limit überschritten |
| count=20000 | 422 Rejected | ❌ Limit überschritten |
| start=5000 (aktuell) | 200 OK, aber start ignoriert | ⚠️ Code bereit, Bridge nicht neu gestartet |

### Bridge-Code-Änderung angewendet (minimal, read-only)

**Datei 1:** `quantpilot-mt5-bridge/app/mt5_client.py`
- `copy_rates()` akzeptiert nun `start: int = 0` Parameter
- `mt5.copy_rates_from_pos(name, tf, start, count)` — statt hardcoded `0`
- Default `start=0` → rückwärtskompatibel

**Datei 2:** `quantpilot-mt5-bridge/app/routes/symbols.py`
- Route akzeptiert nun `start: int = Query(0, ge=0, le=50000)`
- `count` Limit korrigiert: `le=500` → `le=5000` (matching actual bridge behavior)
- Default `start=0` → rückwärtskompatibel
- Nur read-only OHLCV — keine Order-Route, keine Execution-Logik berührt

### Status des laufenden Bridge

```
START_PARAM_STATUS    CODE_READY / RUNTIME_NOT_ACTIVE
```

Der `start`-Parameter ist im Code implementiert, aber der **laufende Bridge-Prozess
muss neu gestartet werden**, damit die Änderung aktiv wird. Bis dahin wird
`start` von FastAPI still ignoriert (beide Batches liefern identische Timestamps).

### Geplanter erweiterter Scan

Sobald der Bridge neu gestartet ist:

```
BATCH 1:  start=0,      count=5000  → Tage 1–5
BATCH 2:  start=5000,   count=5000  → Tage 6–10
BATCH 3:  start=10000,  count=5000  → Tage 11–15
BATCH 4:  start=15000,  count=5000  → Tage 16–20

TOTAL: 20000 M1 Candles ≈ 15–20 Handelstage
```

Ziel-Metriken:
- TRUE A+ FREQUENCY
- LONG/SHORT DISTRIBUTION
- GATE FAILURE DISTRIBUTION
- RR DISTRIBUTION
- SL VALIDITY (alle müssen SL_GEOMETRY = VALID haben)
- SIGNAL FRESHNESS

---

## 4. Erforderliche Benutzeraktion

```
ACTION_REQUIRED: Bridge neu starten
```

**Befehl** (auf Bridge-Host):
```bash
# Bridge-Prozess beenden und neu starten
# z.B. systemctl restart quantpilot-mt5-bridge
# oder manuell: python -m uvicorn app.main:app --host 0.0.0.0 --port $MT5_BRIDGE_PORT
```

Nach dem Neustart kann der erweiterte historische Scan (10–20 Tage)
mit mehreren Batches durchgeführt werden.

---

## 5. Zusammenfassung

```
SL_FIX                 APPLIED ✅
REGRESSION             PASS ✅
  BEFORE: A_PLUS=18, INVALID_SL=8
  AFTER:  A_PLUS=12, INVALID_SL=0

EXTENDED_SCAN          BLOCKED (Bridge-Neustart erforderlich)
BRIDGE_START_PARAM     CODE_READY / RUNTIME_NOT_ACTIVE

ORDER_SEND             BLOCKED
LIVE_EXECUTION         BLOCKED
READ_ONLY              TRUE
PAPER_EXEC             OFF

CODE_CHANGES:
  1. src/lib/ictEngine.js (SL-Richtungslogik)
  2. quantpilot-mt5-bridge/app/mt5_client.py (start-Parameter)
  3. quantpilot-mt5-bridge/app/routes/symbols.py (start-Parameter, count-Limit)

DEFINITION_CHANGES     0
``