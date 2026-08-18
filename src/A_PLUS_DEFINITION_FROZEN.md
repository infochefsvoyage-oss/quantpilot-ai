# PHASE A+ — DEFINITION FREEZE (SHADOW / AUDIT CRITERION)

**Datum:** 2026-08-18
**Basis:** A+ Definition Audit (GAP FOUND) + Checkpoint ICT-XAUUSD-M1-READONLY-VERIFIED
**Status:** A+ DEFINITION FROZEN = YES · CODE CHANGES = 0 · EXECUTION = BLOCKED

**Sicherheitsgatter (unverändert):**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF

---

## 1. Grundsatz

`VALIDATED_SETUP` (bestehend, aus `evaluateDecisionState()` in `ictEngine.js`)
bleibt **unverändert** die produktive Entscheidung der Real-Pipeline. Sie wird
**nicht** umbenannt, **nicht** modifiziert.

`A_PLUS` ist eine **strengere Shadow-Klassifizierung**, die *zusätzlich* zu
`VALIDATED_SETUP` gilt. Sie wird ausschließlich für Audit- und
Shadow-Outcome-Tracking verwendet — **nicht** für Execution.

```
A_PLUS ⊂ VALIDATED_SETUP
```

Jedes A_PLUS-Setup ist automatisch ein VALIDATED_SETUP, aber nicht jedes
VALIDATED_SETUP ist ein A_PLUS.

---

## 2. A_PLUS_DEFINITION — Struktur

### 2.1 REQUIRED (alle müssen TRUE sein)

| # | Bedingung | Quelle | Prüfung | Status |
|---|-----------|--------|---------|--------|
| R1 | **VALIDATED_SETUP = TRUE** | `ictEngine.js` `evaluateDecisionState()` | `hasSweep ∧ hasDisplacement ∧ hasFVGorOB ∧ sideAligned ∧ inKillzone` | Aus bestehendem Code |
| R2 | **Liquidity Sweep** | `ictEngine.js` `detectLiquiditySweep()` | `sweep.sweep === true` | In R1 enthalten |
| R3 | **Displacement / BOS** | `ictEngine.js` `detectBOSCHOCH()` | `bos.mss_bos !== "NONE"` | In R1 enthalten |
| R4 | **FVG oder Order Block** | `ictEngine.js` `detectFVG()` / `detectOrderBlock()` | `fvg.detected ∨ ob.detected` | In R1 enthalten |
| R5 | **Side Alignment** | `ictEngine.js` `evaluateDecisionState()` | LONG: BOS.bullish ∧ DISCOUNT; SHORT: BOS.bearish ∧ PREMIUM | In R1 enthalten |
| R6 | **Killzone aktiv** | `ictEngine.js` `getCurrentSession()` | `session ∈ {LONDON, NEW_YORK}` | In R1 enthalten |
| R7 | **Gültiger Entry** | `ictEngine.js` `generatePaperSignal()` | `tick.bid != null ∧ entry != null` | Neu als A+-Pflicht |
| R8 | **Gültiger SL** | `ictEngine.js` `generatePaperSignal()` | `stopLoss != null` (aus OB oder Sweep-Level) | Neu als A+-Pflicht |
| R9 | **Gültige TP1** | `ictEngine.js` `generatePaperSignal()` | `tp1 != null` (entry ± risk × 2) | Neu als A+-Pflicht |
| R10 | **Gültige TP2** | `ictEngine.js` `generatePaperSignal()` | `tp2 != null` (entry ± risk × 3) | Neu als A+-Pflicht |
| R11 | **RR ≥ 1.8** | `ictEngine.js` `rrInAllowedRange()` | `rr >= 1.8` | Neu als A+-Pflicht |
| R12 | **RR ≤ 4.0** | `ictEngine.js` `rrInAllowedRange()` | `rr <= 4.0` | Neu als A+-Pflicht |
| R13 | **Signal FRESH** | `ictEngine.js` `checkSignalFreshness()` | `signal_age_ms <= 5000` | Neu als A+-Pflicht |
| R14 | **Kein STALE_SIGNAL** | `ictEngine.js` `checkSignalFreshness()` | `signal_status === "FRESH"` | Neu als A+-Pflicht |
| R15 | **Structure Version aktuell** | `ictEngine.js` `computeStructureVersion()` | `structure_changed === false` (oder erster Sample) | Neu als A+-Pflicht |
| R16 | **Echte XAUUSD-M1-Candles** | `fetchICTPipelineSnapshot` | `snap.candles.length >= 10 ∧ snap.rates_available === true` | Real-Data-Integrität |
| R17 | **Keine Mock-Daten** | Pipeline-Quelle | `snap.bridge_tier === "BACKEND_CONNECTED"` (nicht UI_CONTRACT/Mock) | Real-Data-Integrität |
| R18 | **ERROR_RATE = 0** | `ictPerformanceMonitor.js` | `perfMetrics.error_rate === 0` im aktuellen Sample | Real-Data-Integrität |
| R19 | **RECONCILIATION = 100%** | `ictPerformanceMonitor.js` | `perfMetrics.reconciliation_rate === 100` | Real-Data-Integrität |

**A_PLUS = TRUE gdw. R1 ∧ R7 ∧ R8 ∧ R9 ∧ R10 ∧ R11 ∧ R12 ∧ R13 ∧ R14 ∧ R15 ∧ R16 ∧ R17 ∧ R18 ∧ R19**

(R2–R6 sind in R1 enthalten.)

### 2.2 OPTIONAL (nicht erforderlich für A+, aber dokumentiert zur zukünftigen Erweiterung)

| # | Bedingung | Bemerkung |
|---|-----------|-----------|
| O1 | FVG **UND** OB (statt OR) | Strengere Variante; aktuell OR in VALIDATED_SETUP |
| O2 | Unterscheidung BOS vs. MSS/CHOCH | Aktuell nicht im Code; könnte Reversal vs. Continuation trennen |
| O3 | HTF-Alignment (M5/M15/H1) | Siehe NOT_IMPLEMENTED |
| O4 | News-Gate frei | Siehe NOT_IMPLEMENTED |
| O5 | Risk-Engine approved | Siehe NOT_IMPLEMENTED |
| O6 | Governance approved | Siehe NOT_IMPLEMENTED |

### 2.3 MISSING (im Code vorhanden, aber NICHT Teil von VALIDATED_SETUP — jetzt als A+-Pflicht ergänzt)

| # | Bedingung | Wo im Code | Warum MISSING in VALIDATED_SETUP |
|---|-----------|------------|----------------------------------|
| M1 | Gültiger Entry | `generatePaperSignal()` | Wird erst NACH Entscheidung berechnet; nicht Teil von `evaluateDecisionState()` |
| M2 | Gültiger SL | `generatePaperSignal()` | Wie M1 |
| M3 | Gültige TP1 / TP2 | `generatePaperSignal()` | Wie M1 |
| M4 | RR 1.8–4.0 | `rrInAllowedRange()` in `generatePaperSignal()` | Filtern nur das Paper-Signal, nicht die Entscheidung → RR-Disconnect |
| M5 | Signal FRESH | `checkSignalFreshness()` | Separat berechnet; VALIDATED_SETUP kann STALE sein |
| M6 | Structure Version aktuell | `computeStructureVersion()` | Nur Recalculation-Detection; keine Bedingung |

→ Diese MISSING-Bedingungen sind jetzt **REQUIRED** für A_PLUS (R7–R15), ohne
den bestehenden Code zu verändern. Sie werden im Shadow-Scanner
**zusätzlich** zu `VALIDATED_SETUP` ausgewertet.

### 2.4 NOT_IMPLEMENTED (existieren nicht in der realen ICT-Pipeline — NICHT simulieren)

| # | Bedingung | Existiert wo? | Status |
|---|-----------|---------------|--------|
| N1 | **HTF Alignment** | Nur in `ictData.js` `calculateICTScore()` (Mock-System) | NOT IMPLEMENTED in Real-Pipeline |
| N2 | **News Gate** | Nur in `ictData.js` `evaluateHardGates()` (Mock) | NOT IMPLEMENTED in Real-Pipeline |
| N3 | **Risk Approved** | Nur in `ictData.js` `evaluateHardGates()` (Mock) | NOT IMPLEMENTED in Real-Pipeline |
| N4 | **Governance Approved** | Nur in `ictData.js` `evaluateHardGates()` (Mock) | NOT IMPLEMENTED in Real-Pipeline |

**Diese Bedingungen werden NICHT als A+-Pflichtbedingung erfunden.** Sie
werden im Shadow-Scanner als `NOT_IMPLEMENTED` ausgewiesen und nicht
künstlich simuliert. Erst wenn sie in der Real-Pipeline implementiert sind,
können sie in die A_PLUS-Definition aufgenommen werden.

---

## 3. Entscheidungsbaum (A_PLUS Shadow-Klassifizierung)

```
                    ┌─────────────────────────────────┐
                    │  analyzeICT(candles, "LONG/SHORT")│
                    │  auf echten XAUUSD-M1-Candles     │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │  VALIDATED_SETUP = TRUE?         │
                    │  (R1: Sweep ∧ BOS ∧ FVG/OB ∧     │
                    │   Side ∧ Killzone)               │
                    └────────────────┬────────────────┘
                                     │
                          NO ────────┴──────── YES
                          │                     │
                          ▼                     ▼
                    NOT_A_PLUS        ┌──────────────────────┐
                                     │  valid Entry / SL?   │
                                     │  (R7, R8)             │
                                     └──────────┬───────────┘
                                                │
                                     NO ────────┴──────── YES
                                     │                     │
                                     ▼                     ▼
                               NOT_A_PLUS        ┌──────────────────────┐
                                                 │  valid TP1 / TP2?    │
                                                 │  (R9, R10)            │
                                                 └──────────┬───────────┘
                                                            │
                                                 NO ────────┴──────── YES
                                                 │                     │
                                                 ▼                     ▼
                                           NOT_A_PLUS        ┌──────────────────────┐
                                                             │  RR 1.8–4.0?         │
                                                             │  (R11, R12)           │
                                                             └──────────┬───────────┘
                                                                        │
                                                 NO ────────────────────┴──────── YES
                                                 │                                   │
                                                 ▼                                   ▼
                                           NOT_A_PLUS                  ┌──────────────────────┐
                                                                       │  Signal FRESH?       │
                                                                       │  (R13, R14)           │
                                                                       │  signal_age ≤ 5000ms  │
                                                                       └──────────┬───────────┘
                                                                                  │
                                                       NO ────────────────────┴──────── YES
                                                       │                                   │
                                                       ▼                                   ▼
                                                 NOT_A_PLUS                  ┌──────────────────────┐
                                                                             │  Structure current? │
                                                                             │  (R15)               │
                                                                             │  structure_changed  │
                                                                             │  === false           │
                                                                             └──────────┬───────────┘
                                                                                        │
                                                             NO ────────────────────┴──────── YES
                                                             │                                   │
                                                             ▼                                   ▼
                                                       NOT_A_PLUS                  ┌──────────────────────┐
                                                                                   │  Real-data integrity?│
                                                                                   │  (R16, R17, R18, R19) │
                                                                                   │  echte Candles,       │
                                                                                   │  ERROR_RATE=0,        │
                                                                                   │  RECON=100%           │
                                                                                   └──────────┬───────────┘
                                                                                              │
                                                                   NO ────────────────────┴──────── YES
                                                                   │                                   │
                                                                   ▼                                   ▼
                                                             NOT_A_PLUS                         ╔══════════╗
                                                                                               ║ A_PLUS   ║
                                                                                               ║ = TRUE   ║
                                                                                               ╚══════════╝
                                                                                                    │
                                                                                                    ▼
                                                                                       ┌──────────────────────┐
                                                                                       │  Shadow Outcome       │
                                                                                       │  Tracking (Paper)     │
                                                                                       │  Entry / SL / TP1 /   │
                                                                                       │  TP2 / MFE / MAE /    │
                                                                                       │  R-Multiple           │
                                                                                       │  KEINE ORDER          │
                                                                                       └──────────────────────┘
```

---

## 4. Shadow-Outcome-Tracking (bei A_PLUS = TRUE)

Wenn ein A_PLUS-Kandidat entsteht, wird der Snapshot eingefroren und das
Outcome (Paper, nicht Order) über die Lebensdauer des Setups getrackt:

| Feld | Quelle |
|------|--------|
| `timestamp` | A_PLUS-Detektion-Zeit |
| `direction` | LONG / SHORT |
| `structure` | `bos.mss_bos` + `bos.direction` |
| `liquidity` | `sweep.pool` + `sweep.direction` + `sweep.level` |
| `displacement` | `bos.mss_bos !== "NONE"` |
| `fvg` | `fvg.detected` + `fvg.type` + `fvg.top` + `fvg.bottom` |
| `ob` | `ob.detected` + `ob.type` + `ob.high` + `ob.low` |
| `premium_discount` | `premiumDiscount.zone` |
| `killzone` | `session.name` |
| `entry` | `tick.bid` |
| `sl` | `stopLoss` (OB oder Sweep-Level) |
| `tp1` | `entry ± risk × 2` |
| `tp2` | `entry ± risk × 3` |
| `rr` | `computeRR(entry, sl, tp1)` |
| `signal_freshness` | `signal_age_ms` + `signal_status` |
| `structure_version` | `computeStructureVersion(swings)` |
| `entry_reached` | Paper-Outcome |
| `sl_reached` | Paper-Outcome |
| `tp1_reached` | Paper-Outcome |
| `tp2_reached` | Paper-Outcome |
| `mfe` | Maximum Favorable Excursion |
| `mae` | Maximum Adverse Excursion |
| `actual_r_multiple` | Tatsächliches R-Multiple |

---

## 5. Abschluss-Bestätigung

```
A+ DEFINITION FROZEN = YES
CODE CHANGES          = 0
EXECUTION             = BLOCKED
ORDER_SEND            = BLOCKED
LIVE_EXECUTION        = BLOCKED
READ_ONLY             = TRUE
PAPER_EXEC            = OFF
```

**Nächster Schritt (nach Freigabe):** A+ Real-Data Shadow Scan über 30–60
Minuten auf echten XAUUSD-M1-Candles. Keine Orders, keine Execution, keine
Mock-Daten. Falls kein A_PLUS entsteht, ist das ein gültiges Ergebnis und darf
nicht durch Lockerung der Gates erzwungen werden.