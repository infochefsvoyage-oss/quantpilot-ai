# A+ CRITICAL VALIDITY RE-AUDIT — ABSCHLUSSBERICHT

**Datum:** 2026-08-18 21:11 UTC (23:11 Europe/Zurich)
**Phase:** A+ — CRITICAL VALIDITY RE-AUDIT
**Basis:** Historischer Real-Data Scan (5000 XAUUSD M1 Candles) + SL-Geometrie-Validierung

**Sicherheitsgatter (unverändert):**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF

**Keine Codeänderung. Keine Definitionsänderung. Audit-only.**

---

## 1. SL-Validierung exakt traced

### Wo wird `stop_loss` erzeugt?

**Datei:** `src/lib/ictEngine.js`, **Zeile 289** (`generatePaperSignal()`):

```js
const stopLoss = ob && ob.type === "BULLISH" ? ob.low
               : ob && ob.type === "BEARISH" ? ob.high
               : (sweep ? sweep.level : null);
```

**Logik:** Der SL wird aus dem **OB-Typ** bestimmt, nicht aus der Trade-Richtung:
- OB BULLISH → SL = `ob.low` (unterhalb des OB)
- OB BEARISH → SL = `ob.high` (oberhalb des OB)
- Kein OB, aber Sweep → SL = `sweep.level`
- Sonst → `null`

### Wo wird geprüft, ob der SL valide ist?

**Zeile 290-292:**
```js
if (!entry || !stopLoss) return null;
const risk = Math.abs(entry - stopLoss);
if (risk === 0) return null;
```

**Es wird NICHT geprüft, ob der SL auf der korrekten Seite des Entry liegt.**
Die einzige "Validierung" ist:
1. SL ist nicht `null` (existiert)
2. `risk = Math.abs(entry - stopLoss) > 0` (SL ≠ Entry)

### Wird die Prüfung relativ zu `direction` durchgeführt?

**NEIN.** Die `direction` (Zeile 293: `const direction = components.side`) wird
erst **nach** der SL-Bestimmung verwendet — und zwar nur für TP1/TP2 (Zeilen
294-295), nicht für die SL-Validierung.

### Wird die Prüfung relativ zum OB-Typ durchgeführt?

**JA, ausschließlich.** Der SL richtet sich nach `ob.type`, unabhängig davon,
ob die Trade-Richtung LONG oder SHORT ist.

### RR-Berechnung verdeckt die falsche Seite

**Zeile 209 (`computeRR`):**
```js
const risk = Math.abs(entry - stopLoss);
const reward = Math.abs(takeProfit - entry);
```

`Math.abs()` macht `risk` immer positiv — auch wenn der SL auf der falschen
Seite liegt. Da TP1 = Entry ± Risk × 2 (Zeile 294), ist RR immer exakt 2.0,
unabhängig von der SL-Geometrie. Der RR-Check `rrInAllowedRange(rr)` (Zeile
297: `rr >= 1.8 && rr <= 4.0`) passt immer.

### Zusammenfassung des SL_LOGIC_GAP

```
SL_LOGIC_GAP = CONFIRMED

Ursache:   generatePaperSignal() bestimmt SL aus OB-Typ, nicht aus direction.
Verdeckung: Math.abs() bei risk (Zeile 291) und computeRR (Zeile 209)
           macht RR immer positiv — auch bei geometrisch falschem SL.
Folge:     LONG mit BEARISH OB → SL = ob.high > Entry → INVALID
           SHORT mit BULLISH OB → SL = ob.low < Entry → INVALID
           Diese Setups passieren alle A+-Gates, weil die SL-Geometrie
           nirgends geprüft wird.
```

---

## 2. Alle 18 A+-Kandidaten mit SL-Geometrie auditiert

| # | Datum | Zeit (UTC) | Dir | KZ | Entry | SL | SL_Source | OB_Type | SL_Geometry | Valid A+ |
|---|-------|-----------|-----|-----|-------|----|-----------|---------|------------|----------|
| 1 | 08-13 | 07:44 | LONG | NY | 4375.46 | 4378.67 | OB_BEARISH_high | BEARISH | **INVALID** | ❌ |
| 2 | 08-13 | 08:23 | LONG | NY | 4369.95 | 4368.60 | OB_BULLISH_low | BULLISH | VALID | ✅ |
| 3 | 08-13 | 09:05 | SHORT | NY | 4373.76 | 4376.54 | OB_BEARISH_high | BEARISH | VALID | ✅ |
| 4 | 08-13 | 09:06 | SHORT | NY | 4373.79 | 4376.54 | OB_BEARISH_high | BEARISH | VALID | ✅ |
| 5 | 08-13 | 09:47 | SHORT | NY | 4378.58 | 4380.62 | OB_BEARISH_high | BEARISH | VALID | ✅ |
| 6 | 08-13 | 09:49 | SHORT | NY | 4379.27 | 4378.56 | OB_BULLISH_low | BULLISH | **INVALID** | ❌ |
| 7 | 08-14 | 02:32 | LONG | LON | 4315.82 | 4321.25 | OB_BEARISH_high | BEARISH | **INVALID** | ❌ |
| 8 | 08-14 | 04:59 | LONG | LON | 4324.97 | 4326.86 | OB_BEARISH_high | BEARISH | **INVALID** | ❌ |
| 9 | 08-14 | 08:14 | SHORT | NY | 4347.77 | 4344.15 | OB_BULLISH_low | BULLISH | **INVALID** | ❌ |
| 10 | 08-14 | 08:15 | SHORT | NY | 4347.45 | 4348.63 | OB_BEARISH_high | BEARISH | VALID | ✅ |
| 11 | 08-14 | 08:55 | SHORT | NY | 4348.94 | 4346.61 | OB_BULLISH_low | BULLISH | **INVALID** | ❌ |
| 12 | 08-14 | 08:56 | SHORT | NY | 4347.32 | 4349.68 | OB_BEARISH_high | BEARISH | VALID | ✅ |
| 13 | 08-17 | 07:54 | SHORT | NY | 4405.61 | 4403.52 | OB_BULLISH_low | BULLISH | **INVALID** | ❌ |
| 14 | 08-18 | 04:11 | LONG | LON | 4392.59 | 4391.58 | OB_BULLISH_low | BULLISH | VALID | ✅ |
| 15 | 08-18 | 04:12 | LONG | LON | 4392.48 | 4391.58 | OB_BULLISH_low | BULLISH | VALID | ✅ |
| 16 | 08-18 | 04:13 | LONG | LON | 4392.28 | 4391.58 | OB_BULLISH_low | BULLISH | VALID | ✅ |
| 17 | 08-18 | 04:14 | LONG | LON | 4392.92 | 4392.07 | OB_BULLISH_low | BULLISH | VALID | ✅ |
| 18 | 08-18 | 04:16 | LONG | LON | 4392.05 | 4393.66 | OB_BEARISH_high | BEARISH | **INVALID** | ❌ |

### Muster

**SL-Geometrie ist VALID genau dann, wenn OB-Typ zur Trade-Richtung passt:**
- LONG + BULLISH OB → SL = ob.low < Entry → **VALID**
- SHORT + BEARISH OB → SL = ob.high > Entry → **VALID**
- LONG + BEARISH OB → SL = ob.high > Entry → **INVALID**
- SHORT + BULLISH OB → SL = ob.low < Entry → **INVALID**

Alle 8 INVALID-Setups haben den **OB-Typ, der der Trade-Richtung widerspricht**.

---

## 3. A+ Ergebnis neu klassifiziert

```
ORIGINAL_A_PLUS        18
INVALID_SL             8
VALID_A_PLUS           10
LONG_VALID_A_PLUS      5
SHORT_VALID_A_PLUS     5
```

### Die 10 validen A+-Setups

| # | Datum | Zeit (UTC) | Dir | KZ | Entry | SL | TP1 | TP2 | RR |
|---|-------|-----------|-----|-----|-------|----|-----|-----|----|
| 2 | 08-13 | 08:23 | LONG | NY | 4369.95 | 4368.60 | 4372.65 | 4374.00 | 2.0 |
| 3 | 08-13 | 09:05 | SHORT | NY | 4373.76 | 4376.54 | 4368.20 | 4365.42 | 2.0 |
| 4 | 08-13 | 09:06 | SHORT | NY | 4373.79 | 4376.54 | 4368.29 | 4365.54 | 2.0 |
| 5 | 08-13 | 09:47 | SHORT | NY | 4378.58 | 4380.62 | 4374.50 | 4372.46 | 2.0 |
| 10 | 08-14 | 08:15 | SHORT | NY | 4347.45 | 4348.63 | 4345.09 | 4343.91 | 2.0 |
| 12 | 08-14 | 08:56 | SHORT | NY | 4347.32 | 4349.68 | 4342.60 | 4340.24 | 2.0 |
| 14 | 08-18 | 04:11 | LONG | LON | 4392.59 | 4391.58 | 4394.61 | 4395.62 | 2.0 |
| 15 | 08-18 | 04:12 | LONG | LON | 4392.48 | 4391.58 | 4394.28 | 4395.18 | 2.0 |
| 16 | 08-18 | 04:13 | LONG | LON | 4392.28 | 4391.58 | 4393.68 | 4394.38 | 2.0 |
| 17 | 08-18 | 04:14 | LONG | LON | 4392.92 | 4392.07 | 4394.62 | 4395.47 | 2.0 |

Alle 10 haben: Signal FRESH = TRUE, Structure Current = TRUE, RR = 2.0,
SL auf korrekter Seite des Entry.

---

## 4. Historische Abdeckung korrigiert

```
CANDLES_SCANNED         5000
FIRST_CANDLE            2026-08-13T04:44:59 UTC
LAST_CANDLE             2026-08-18T19:10:59 UTC
ACTUAL_TIME_SPAN        5.6 Tage (134.4 Stunden)
TRADING_DAYS_COVERED    5 [08-13, 08-14, 08-16, 08-17, 08-18]
GAPS                    3 (größte: 2944 min = 49h, Wochenende 08-14→08-16)
```

### Bewertung

Die 5000 M1-Candles decken einen tatsächlichen Zeitraum von **5,6 Kalendertagen**
ab (13.08. 04:44 UTC bis 18.08. 19:10 UTC). Darin enthalten sind **5
Handelstage** (08-13, 08-14, 08-16, 08-17, 08-18), getrennt durch ein
Wochenend-Gap von 49 Stunden (08-14 20:55 → 08-16 21:59 UTC).

```
HISTORICAL_COVERAGE = SUFFICIENT
```

Die Aussage `DAYS_SCANNED = 5` ist durch die Timestamps belegbar.

---

## 5. Abschluss

```
ORIGINAL_A_PLUS        18
INVALID_SL             8
VALID_A_PLUS           10
LONG_VALID_A_PLUS      5
SHORT_VALID_A_PLUS     5

SL_LOGIC_GAP           CONFIRMED
HISTORICAL_COVERAGE    SUFFICIENT

ORDER_SEND             BLOCKED
LIVE_EXECUTION         BLOCKED
READ_ONLY              TRUE
PAPER_EXEC             OFF

CODE_CHANGES           0
DEFINITION_CHANGES     0
```

### Bewertung

1. **SL_LOGIC_GAP = CONFIRMED:** `generatePaperSignal()` (ictEngine.js:289)
   bestimmt den SL aus dem OB-Typ ohne Richtungskontrolle. `Math.abs()` bei
   Risk (Zeile 291) und RR (Zeile 209) verdeckt die falsche Geometrie. 44%
   der A+-Kandidaten (8/18) haben SL auf der falschen Seite des Entry.

2. **VALID_A_PLUS = 10:** Nach korrekter SL-Geometrie-Validierung verbleiben
   10 valide A+-Setups (5 LONG, 5 SHORT) in 5 Handelstagen. Das entspricht
   ~2 A+-Setups pro Handelstag — eine plausible Frequenz für Sniper-Trading.

3. **Pipeline-Status:** Die Pipeline ist technisch durchgängig (REAL_DATA =
   PASS, ERROR_RATE = 0%, RECONCILIATION = 100%), aber die
   **Signal-/Risk-Validierung ist noch nicht zuverlässig genug für A+**.

4. **Nächster Schritt:** Nicht Execution, sondern gezielter Fix der
   SL-Richtungslogik in `generatePaperSignal()` + Regressionstest gegen die
   historischen Kandidaten. Erst danach ist die A+-Statistik belastbar.