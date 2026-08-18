# PHASE A+ — ICT DEFINITION AUDIT (READ-ONLY)

**Datum:** 2026-08-18
**Checkpoint-Basis:** ICT-XAUUSD-M1-READONLY-VERIFIED
**Modus:** Read-Only Audit — keine Code-Änderung, keine Strategieänderung, keine Execution

**Sicherheitsgatter (unverändert):**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF

---

## 1. Zentrale Erkenntnis: Es existiert KEINE explizite „A+"-Klassifizierung

Der produktive Code enthält **kein** Label „A+". Die höchste Entscheidungsstufe
heißt **`VALIDATED_SETUP`**. Ob „A+" mit `VALIDATED_SETUP` gleichzusetzen ist,
wurde **nirgendwo im Code definiert oder dokumentiert**.

Zwei parallele, **nicht verbundene** Entscheidungssysteme existieren:

| System | Datei | Funktion | Eingabe | Höchstes Label |
|--------|-------|----------|---------|----------------|
| **Real-Pipeline** | `src/lib/ictEngine.js` | `evaluateDecisionState()` | Echte Candle-Komponenten | `VALIDATED_SETUP` |
| **Mock-Signal-Gates** | `src/lib/ictData.js` | `evaluateDecision()` + `evaluateHardGates()` | Signal-Entity-Felder | `PAPER_ENTRY` |

Die Real-Pipeline (`ICTPipelineMonitor.jsx`) nutzt ausschließlich
`evaluateDecisionState()`. Das Mock-Gate-System (`ictData.js`) operiert auf
`mockICTSignals` und wird im Real-Scan **nicht** ausgewertet.

---

## 2. VALIDATED_SETUP — Exakte Bedingungs-Matrix

**Quelle:** `src/lib/ictEngine.js`, Funktion `evaluateDecisionState()`, Zeilen 165–179

```js
const hasSweep = sweep && sweep.sweep;
const hasDisplacement = bos && bos.mss_bos !== "NONE";
const hasFVGorOB = (fvg && fvg.detected) || (ob && ob.detected);
const sideAligned = side === "LONG"
  ? (bos && bos.direction === "BULLISH") && premiumDiscount.zone === "DISCOUNT"
  : (bos && bos.direction === "BEARISH") && premiumDiscount.zone === "PREMIUM";
const inKillzone = session && (session.name === "LONDON" || session.name === "NEW_YORK");

if (hasSweep && hasDisplacement && hasFVGorOB && sideAligned && inKillzone)
  return "VALIDATED_SETUP";
```

### Bedingungs-Tabelle

| # | CONDITION | SOURCE FILE | FUNCTION | EXACT LOGIC | REQUIRED FOR VALIDATED_SETUP | CURRENT STATUS |
|---|-----------|-------------|----------|-------------|------------------------------|----------------|
| 1 | **Liquidity Sweep** | `ictEngine.js` | `detectLiquiditySweep()` Z.82–95 → `evaluateDecisionState()` Z.167 | `sweep.sweep === true` (Wick nimmt Swing-High/Low, Close kehrt zurück) | **YES** | Aktiv auf realen Candles |
| 2 | **Displacement / MSS-BOS** | `ictEngine.js` | `detectBOSCHOCH()` Z.68–79 → `evaluateDecisionState()` Z.168 | `bos.mss_bos !== "NONE"` (Close bricht letzten Swing-High → BOS BULLISH; Close bricht Swing-Low → BOS BEARISH) | **YES** | Aktiv; nur BOS, kein CHOCH-Mapping |
| 3 | **FVG** | `ictEngine.js` | `detectFVG()` Z.98–112 → `evaluateDecisionState()` Z.169 | `fvg.detected === true` (Bullish: c3.low > c1.high; Bearish: c3.high < c1.low) | **PARTIAL** — FVG ODER OB (OR-Bedingung) | Aktiv, aber nicht zwingend |
| 4 | **Order Block** | `ictEngine.js` | `detectOrderBlock()` Z.115–129 → `evaluateDecisionState()` Z.169 | `ob.detected === true` (Down-Candle gefolgt von starker Up-Candle und umgekehrt) | **PARTIAL** — FVG ODER OB (OR-Bedingung) | Aktiv, aber nicht zwingend |
| 5 | **Premium / Discount** | `ictEngine.js` | `computePremiumDiscount()` Z.132–143 → `evaluateDecisionState()` Z.170–172 | LONG: `premiumDiscount.zone === "DISCOUNT"`; SHORT: `zone === "PREMIUM"` (±10% um Equilibrium) | **YES** (in `sideAligned` enthalten) | Aktiv |
| 6 | **Killzone** | `ictEngine.js` | `getCurrentSession()` Z.16–26 → `evaluateDecisionState()` Z.173 | `session.name === "LONDON" \|\| session.name === "NEW_YORK"` (UTC: 02–05h, 07–10h) | **YES** | Aktiv |
| 7 | **Long-/Short-Alignment** | `ictEngine.js` | `evaluateDecisionState()` Z.170–172 | LONG: `bos.direction === "BULLISH"` AND `zone === "DISCOUNT"`; SHORT: `bos.direction === "BEARISH"` AND `zone === "PREMIUM"` | **YES** | Aktiv |
| 8 | **Market Structure (Swings)** | `ictEngine.js` | `detectSwings()` Z.30–43, `classifyMarketStructure()` Z.45–66 | Fractal-basiert (lookback=2); HH/LH/LL/HL-Klassifikation | **INDIRECT** — liefert Input für BOS/Sweep, aber keine eigene VALIDATED_SETUP-Bedingung | Aktiv |
| 9 | **Entry** | `ictEngine.js` | `generatePaperSignal()` Z.284–318 | `entry = tick.bid` (nur wenn `analysis.valid === true`) | **NO** — nicht Teil von `evaluateDecisionState()` | Wird erst NACH VALIDATED_SETUP berechnet |
| 10 | **Stop Loss** | `ictEngine.js` | `generatePaperSignal()` Z.289 | `stopLoss = ob.low` (BULLISH OB) / `ob.high` (BEARISH OB) / `sweep.level` (Fallback) | **NO** — nicht Teil von `evaluateDecisionState()` | Wird erst NACH VALIDATED_SETUP berechnet |
| 11 | **TP1** | `ictEngine.js` | `generatePaperSignal()` Z.294 | LONG: `entry + risk * 2`; SHORT: `entry - risk * 2` | **NO** — nicht Teil von `evaluateDecisionState()` | Wird erst NACH VALIDATED_SETUP berechnet |
| 12 | **TP2** | `ictEngine.js` | `generatePaperSignal()` Z.295 | LONG: `entry + risk * 3`; SHORT: `entry - risk * 3` | **NO** — nicht Teil von `evaluateDecisionState()` | Wird erst NACH VALIDATED_SETUP berechnet |
| 13 | **RR (Minimum)** | `ictEngine.js` | `computeRR()` Z.207–213, `rrInAllowedRange()` Z.215–217, `generatePaperSignal()` Z.296–297 | `rr >= 1.8 && rr <= 4.0` — wenn außerhalb: `generatePaperSignal()` returns `null` | **NO** — nicht Teil von `evaluateDecisionState()`. VALIDATED_SETUP kann TRUE sein, aber Paper-Signal wird verworfen, wenn RR außerhalb 1.8–4.0 | **GAP** — RR filtert nur das Paper-Signal, nicht die Entscheidung |
| 14 | **Signal Freshness** | `ictEngine.js` | `checkSignalFreshness()` Z.190–205 | `signal_age_ms <= 5000` → `FRESH`; sonst `STALE` + `execution: BLOCKED` | **NO** — nicht Teil von `evaluateDecisionState()` | Wird separat im Monitor berechnet; VALIDATED_SETUP kann STALE sein |
| 15 | **Structure Version** | `ictEngine.js` | `computeStructureVersion()` Z.182–185 | Hash der letzten 5 Swings; Änderung → `structure_changed: true` | **NO** — nicht Teil von `evaluateDecisionState()` | Wird nur für Recalculation-Detection im Performance-Monitor genutzt |
| 16 | **HTF Alignment** | `ictData.js` | `calculateICTScore()` Z.46 | `htf_market_structure === side` (+15 Score-Punkte) | **NO** — nur im ICT-Score (Mock-System), nicht in `evaluateDecisionState()` | Mock-Abhängigkeit |
| 17 | **Hard Gates (risk_approved)** | `ictData.js` | `evaluateHardGates()` Z.81 | `signal.gate_risk_approved === true` | **NO** — existiert nur im Mock-Signal-System, nicht in Real-Pipeline | Mock-Abhängigkeit |
| 18 | **Hard Gates (governance_approved)** | `ictData.js` | `evaluateHardGates()` Z.82 | `signal.gate_governance_approved === true` | **NO** — existiert nur im Mock-Signal-System | Mock-Abhängigkeit |
| 19 | **Hard Gates (news_clear)** | `ictData.js` | `evaluateHardGates()` Z.80 | `signal.gate_news_clear === true` | **NO** — existiert nur im Mock-Signal-System | Mock-Abhängigkeit |
| 20 | **Data Freshness (live/fresh)** | `ictData.js` | `evaluateHardGates()` Z.73–74 | `gate_live_data === true && gate_data_fresh === true` | **NO** — nicht in `evaluateDecisionState()`; Tick-Freshness wird separat im Snapshot geprüft | Separater Pfad |

---

## 3. Gap-Report

### 3.1 EXISTING A+ LOGIC (was der Code tatsächlich als VALIDATED_SETUP definiert)

```
VALIDATED_SETUP = TRUE wenn und nur wenn:
  ① Liquidity Sweep       detected  (sweep.sweep === true)
  ② Displacement / BOS    detected  (bos.mss_bos !== "NONE")
  ③ FVG ODER Order Block  detected  (fvg.detected ∨ ob.detected)
  ④ Side-Alignment         korrekt  (LONG: BOS.bullish ∧ DISCOUNT | SHORT: BOS.bearish ∧ PREMIUM)
  ⑤ Killzone              aktiv    (LONDON ∨ NEW_YORK)
```

Das ist eine **5-Bedingungs-AND-Verknüpfung**. Keine weitere Bedingung wird
geprüft. Dies ist die **einzige** Definition von „bestes Setup" im
Real-Pipeline-Pfad.

### 3.2 MISSING CONDITIONS (fehlen in VALIDATED_SETUP, aber vom A+-Konzept erwartet)

| Fehlende Bedingung | Wo im Code vorhanden | Warum kritisch |
|--------------------|----------------------|----------------|
| **Entry valid** | Nur in `generatePaperSignal()` (Post-Decision) | VALIDATED_SETUP kann ohne validen Entry gemeldet werden (tick.bid = null → kein Paper-Signal, aber Decision bleibt VALIDATED_SETUP) |
| **SL valid** | Nur in `generatePaperSignal()` | SL kann null sein (kein OB, kein Sweep-Level) → Paper-Signal null, aber Decision bleibt VALIDATED_SETUP |
| **TP1 / TP2 valid** | Nur in `generatePaperSignal()` | Abhängig von validem Entry + SL; nicht Teil der Entscheidung |
| **RR ≥ Minimum** | Nur `rrInAllowedRange()` in `generatePaperSignal()` | **Kritischer Gap:** VALIDATED_SETUP kann TRUE sein, aber RR < 1.8 → Paper-Signal verworfen. Die Entscheidung selbst wird nicht durch RR gefiltert. |
| **Signal Freshness** | `checkSignalFreshness()` separat | VALIDATED_SETUP kann STALE sein (signal_age > 5s). Keine Sperrung der Entscheidung. |
| **Structure Version aktuell** | Nur Recalculation-Detection | Keine Bedingung, dass Structure stabil sein muss |
| **HTF Alignment** | Nur in Mock-Score | Hochzeit mit HTF-Struktur nicht in Real-Pipeline geprüft |
| **News-Gate frei** | Nur Mock-Hard-Gate | Kein News-Filter in Real-Pipeline |
| **Risk Approved** | Nur Mock-Hard-Gate | Keine Risk-Engine-Prüfung in Real-Pipeline |
| **Governance Approved** | Nur Mock-Hard-Gate | Keine Governance-Prüfung in Real-Pipeline |

### 3.3 AMBIGUOUS CONDITIONS

| Bedingung | Ambiguität |
|-----------|------------|
| **FVG vs. OB** | `hasFVGorOB` ist eine OR-Bedingung. Es ist unklar, ob A+ BEIDE erfordert (FVG AND OB) oder nur EINES (FVG OR OB). Aktuell: OR. |
| **Displacement = BOS** | `hasDisplacement` prüft nur `bos.mss_bos !== "NONE"`. Es wird nicht zwischen BOS (Break of Structure, Trendfortsetzung) und MSS/CHOCH (Market Structure Shift, Reversal) unterschieden. |
| **„A+" = VALIDATED_SETUP?** | Nirgendwo dokumentiert. Ob VALIDATED_SETUP die A+-Schwelle ist oder ob A+ eine strengere Untermenge sein sollte, ist nicht definiert. |
| **Killzone-Definition** | `getCurrentSession()` nutzt UTC-Stunden. ASIA wrappt Mitternacht (20–0h). LONDON_CLOSE (10–12h) ist nicht in `inKillzone` enthalten, aber in `ICT_KILLZONES` (ictData.js) gelistet. Inkonsistenz zwischen beiden Definitionen. |

### 3.4 MOCK-DEPENDENCIES

| Mock-Element | Datei | Status in Real-Pipeline |
|--------------|-------|-------------------------|
| `mockICTSignals` (4 Signale) | `ictData.js` Z.138–331 | **NICHT verwendet** — Real-Pipeline nutzt `analyzeICT()` auf echten Candles |
| `evaluateDecision()` / `evaluateHardGates()` | `ictData.js` Z.71–98 | **NICHT verwendet** — Real-Pipeline nutzt `evaluateDecisionState()` |
| `calculateICTScore()` | `ictData.js` Z.42–68 | **NICHT verwendet** in Real-Pipeline (nur in Mock-Karten) |
| `feedStatus` (connected: false, mode: MOCK) | `ictData.js` Z.334–340 | **STALE/IRREFÜHREND** — Real-Pipeline ist verbunden, aber diese Konstante behauptet MOCK |
| `gate_risk_approved`, `gate_governance_approved`, `gate_news_clear` | `ictData.js` | **NIEMALS gesetzt** in Real-Pipeline — nur in Mock-Signalen |

### 3.5 REAL-DATA DEPENDENCIES

| Real-Element | Quelle | Status |
|--------------|--------|--------|
| Echte M1-Candles (100) | `fetchICTPipelineSnapshot` → Bridge `/symbols/XAUUSD/rates` | ✅ Aktiv, 0 Gaps |
| Echter Tick (bid/ask) | `fetchICTPipelineSnapshot` → Bridge `/symbols/XAUUSD/tick` | ✅ Aktiv |
| `analyzeICT(candles, "LONG"/"SHORT")` | `ictEngine.js` Z.220–281 | ✅ Läuft auf realen Candles |
| `evaluateDecisionState(components)` | `ictEngine.js` Z.165–179 | ✅ Läuft auf realen Komponenten |
| `generatePaperSignal(analysis, tick)` | `ictEngine.js` Z.284–318 | ✅ Läuft, aber nur wenn `analysis.valid === true` |
| `checkSignalFreshness()` | `ictEngine.js` Z.190–205 | ✅ Aktiv, aber nicht Teil der Entscheidung |
| `computeStructureVersion()` | `ictEngine.js` Z.182–185 | ✅ Aktiv, aber nicht Teil der Entscheidung |

---

## 4. Audit-Verdict

### A+ DEFINITION AUDIT = **GAP FOUND**

**Begründung:**

1. **Keine explizite A+-Definition existiert.** Der Code definiert
   `VALIDATED_SETUP` als höchste Stufe, aber ob dies „A+" entspricht, ist
   nirgendwo festgelegt.

2. **VALIDATED_SETUP prüft nur 5 Bedingungen** (Sweep, Displacement/BOS,
   FVG-ODER-OB, Side-Alignment, Killzone). Die vom A+-Konzept erwarteten
   Bedingungen **Entry valid, SL valid, TP1/TP2 valid, RR ≥ Minimum, Signal
   Freshness, Structure Version aktuell** sind **NICHT** Teil der
   `VALIDATED_SETUP`-Entscheidung.

3. **Kritischer RR-Disconnect:** `VALIDATED_SETUP` kann TRUE sein, während
   `generatePaperSignal()` null zurückgibt (RR außerhalb 1.8–4.0). Die
   Entscheidung und das Paper-Signal sind nicht konsistent gekoppelt.

4. **Zwei parallele, nicht verbundene Gate-Systeme:** Das Mock-Hard-Gate-System
   (`ictData.js`) mit Risk/Governance/News-Gates wird in der Real-Pipeline
   **nicht** ausgewertet.

5. **FVG/OB als OR-Bedingung** ist mehrdeutig — A+ könnte beide erfordern.

6. **Keine Unterscheidung BOS vs. MSS/CHOCH** — `hasDisplacement` behandelt
   beide als gleichwertig.

---

## 5. Empfehlung

**KEINE eigenständige Reparatur.** Die identifizierten Gaps werden hier nur
dokumentiert und erfordern **ausdrückliche Freigabe** vor jeder Code-Änderung.

**Nächste Schritte (nach Freigabe):**

1. **Entscheidung erforderlich:** Ist `VALIDATED_SETUP` = „A+", oder soll eine
   strengere `A_PLUS`-Stufe eingeführt werden, die zusätzlich RR ≥ Minimum,
   Signal Freshness, Entry/SL/TP-valid verlangt?

2. **Erst nach Klärung:** A+ Real-Data Shadow Scan über 30–60 Minuten mit
   Erfassung aller VALIDATED_SETUP-Kandidaten (und ggf. A_PLUS-Untermenge).

3. **Shadow Outcome Tracking** (Paper, nicht Order): Entry erreicht? SL
   erreicht? TP1/TP2 erreicht? MFE/MAE? Tatsächliches R-Multiple.

**Bis zur Freigabe bleiben alle Gatter unverändert:**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF