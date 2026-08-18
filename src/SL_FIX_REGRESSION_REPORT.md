# PHASE SL-FIX — DIRECTIONAL STOP-LOSS REPAIR — ABSCHLUSSBERICHT

**Datum:** 2026-08-18 21:15 UTC (23:15 Europe/Zurich)
**Phase:** SL-FIX — Directional Stop-Loss Repair + Regression Test

**Sicherheitsgatter (unverändert):**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF

---

## 1. SL-Richtungslogik repariert

### Datei: `src/lib/ictEngine.js`, `generatePaperSignal()`

**VORHER (Zeile 289 — SL aus OB-Typ, ohne Richtungskontrolle):**
```js
const stopLoss = ob && ob.type === "BULLISH" ? ob.low
               : ob && ob.type === "BEARISH" ? ob.high
               : (sweep ? sweep.level : null);
if (!entry || !stopLoss) return null;
const risk = Math.abs(entry - stopLoss);  // ← Math.abs verdeckt falsche Seite
```

**NACHHER (SL aus Richtung, mit Geometrie-Validierung):**
```js
const direction = components.side;
let stopLoss = null;
if (direction === "LONG") {
  // LONG → SL muss < Entry: BULLISH OB low oder Sweep unter Entry
  if (ob && ob.type === "BULLISH" && ob.low != null && ob.low < entry) stopLoss = ob.low;
  else if (sweep && sweep.level != null && sweep.level < entry) stopLoss = sweep.level;
} else {
  // SHORT → SL muss > Entry: BEARISH OB high oder Sweep über Entry
  if (ob && ob.type === "BEARISH" && ob.high != null && ob.high > entry) stopLoss = ob.high;
  else if (sweep && sweep.level != null && sweep.level > entry) stopLoss = sweep.level;
}
if (!stopLoss) return null;
// Geometrie-Validierung (zwingend VOR Risk/RR)
const slGeometryValid = direction === "LONG" ? stopLoss < entry : stopLoss > entry;
if (!slGeometryValid) return null;
const risk = Math.abs(entry - stopLoss);  // ← erst nach gültiger Geometrie
```

### Was geändert wurde
- SL-Auswahl richtet sich nach **Trade-Richtung**, nicht nach OB-Typ
- LONG: BULLISH OB low (unter Entry) oder Sweep-Level (unter Entry)
- SHORT: BEARISH OB high (über Entry) oder Sweep-Level (über Entry)
- **Geometrie-Validierung** zwingend vor Risk/RR-Berechnung
- Fallback auf Sweep-Level, falls OB-Typ nicht zur Richtung passt

### Was NICHT geändert wurde
- A+-Definition (eingefroren) — unverändert
- Liquidity-/Structure-/FVG-/OB-Gates — unverändert
- Killzone-Logik — unverändert
- Execution-Logik — unverändert
- Keine Order Route aufgerufen
- `computeRR()` und `rrInAllowedRange()` — unverändert

---

## 2. Regressionstest

### Daten
- 5000 XAUUSD M1 Candles (gleiche Daten wie Re-Audit)
- 5 Handelstage (08-13, 08-14, 08-16, 08-17, 08-18)
- Korrigierte SL-Logik angewendet auf alle VALIDATED_SETUPs

### Ergebnis

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

### Regression PASS

1. **INVALID_SL = 0** — alle 8 previously invalid SL-Geometrien beseitigt ✅
2. **Alle 10 previously valid A+-Setups** unverändert erhalten (gleicher SL, gleicher RR) ✅
3. **2 previously invalid Setups rescued** durch Sweep-Level Fallback:
   - Setup #5: SHORT, 08-14 08:14, Entry=4347.77, neuer SL=4347.95 (SWEEP_level, > Entry → VALID)
   - Setup #7: SHORT, 08-14 08:55, Entry=4348.94, neuer SL=4349.32 (SWEEP_level, > Entry → VALID)
4. **6 previously invalid Setups discarded** — kein valider SL-Kandidat auf korrekter Seite
5. **SL_GEOMETRY Gate: 6 First-Failures** (neues Gate durch korrigierte Logik)
6. **Alle 12 A+-Setups: SL_GEOMETRY = VALID, RR = 2.0, FRESH, Current Structure** ✅

### Die 12 A+-Setups nach Fix

| # | Datum | Zeit (UTC) | Dir | KZ | Entry | SL | SL_Source | TP1 | TP2 | RR |
|---|-------|-----------|-----|-----|-------|----|-----------|-----|-----|----|
| 1 | 08-13 | 08:24 | LONG | NY | 4369.95 | 4368.60 | OB_BULLISH_low | 4372.65 | 4374.00 | 2.0 |
| 2 | 08-13 | 09:06 | SHORT | NY | 4373.76 | 4376.54 | OB_BEARISH_high | 4368.20 | 4365.42 | 2.0 |
| 3 | 08-13 | 09:07 | SHORT | NY | 4373.79 | 4376.54 | OB_BEARISH_high | 4368.29 | 4365.54 | 2.0 |
| 4 | 08-13 | 09:48 | SHORT | NY | 4378.58 | 4380.62 | OB_BEARISH_high | 4374.50 | 4372.46 | 2.0 |
| 5 | 08-14 | 08:15 | SHORT | NY | 4347.77 | 4347.95 | SWEEP_level | 4347.41 | 4347.23 | 2.0 |
| 6 | 08-14 | 08:16 | SHORT | NY | 4347.45 | 4348.63 | OB_BEARISH_high | 4345.09 | 4343.91 | 2.0 |
| 7 | 08-14 | 08:56 | SHORT | NY | 4348.94 | 4349.32 | SWEEP_level | 4348.18 | 4347.80 | 2.0 |
| 8 | 08-14 | 08:57 | SHORT | NY | 4347.32 | 4349.68 | OB_BEARISH_high | 4342.60 | 4340.24 | 2.0 |
| 9 | 08-18 | 04:12 | LONG | LON | 4392.59 | 4391.58 | OB_BULLISH_low | 4394.61 | 4395.62 | 2.0 |
| 10 | 08-18 | 04:13 | LONG | LON | 4392.48 | 4391.58 | OB_BULLISH_low | 4394.28 | 4395.18 | 2.0 |
| 11 | 08-18 | 04:14 | LONG | LON | 4392.28 | 4391.58 | OB_BULLISH_low | 4393.68 | 4394.38 | 2.0 |
| 12 | 08-18 | 04:15 | LONG | LON | 4392.92 | 4392.07 | OB_BULLISH_low | 4394.62 | 4395.47 | 2.0 |

### RR-Verteilung
- Min: 2.0 · Max: 2.0 · Avg: 2.0
- Alle 12 Setups haben RR = 2.0 (TP1 = Entry ± Risk × 2 per Konstruktion)

### SL-Source-Verteilung
- OB_BULLISH_low: 5 (alle LONG)
- OB_BEARISH_high: 5 (alle SHORT)
- SWEEP_level: 2 (beide SHORT — zuvor invalid, durch Fix rescued)

---

## 3. Bewertung

**Regression PASS.** Der SL-Fix funktioniert korrekt:
- INVALID_SL = 0 (alle falschen Geometrien beseitigt)
- Alle 10 previously valid Setups unverändert (kein Regressionsschaden)
- 2 zusätzliche Setups durch Sweep-Level Fallback rescued (geometrisch korrekt)
- 6 Setups verworfen (kein valider SL auf korrekter Seite)
- A+-Frequenz: 12 Setups in 5 Handelstagen ≈ 2,4 A+/Tag

**Die A+-Statistik ist nach dem Fix belastbar** — alle 12 Setups haben
geometrisch korrekte SL, validen RR, FRESH Signal und Current Structure.

```
REGRESSION_RESULT        PASS
SL_LOGIC_GAP             FIXED
INVALID_SL               0
VALID_A_PLUS             12

ORDER_SEND               BLOCKED
LIVE_EXECUTION           BLOCKED
READ_ONLY                TRUE
PAPER_EXEC               OFF

CODE_CHANGES             1 (ictEngine.js generatePaperSignal SL logic only)
DEFINITION_CHANGES       0
``