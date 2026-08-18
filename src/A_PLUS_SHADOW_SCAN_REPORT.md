# A+ REAL-DATA SHADOW SCAN — ABSCHLUSSBERICHT

**Datum:** 2026-08-18 19:00 UTC (21:00 Europe/Zurich)
**Symbol:** XAUUSD · **Timeframe:** M1
**Datenquelle:** Vantage MT5 → Bridge → fetchICTPipelineSnapshot → analyzeICT()
**Definition:** A_PLUS_DEFINITION_FROZEN (19 REQUIRED-Bedingungen)

**Sicherheitsgatter (unverändert):**
- ORDER_SEND = BLOCKED
- LIVE_EXECUTION = BLOCKED
- READ_ONLY = TRUE
- PAPER_EXEC = OFF

---

## Abschlussbericht

```
A+ REAL-DATA SHADOW SCAN
========================
REAL_XAUUSD_M1       PASS
CYCLES_SCANNED       5
LONG_A_PLUS          0
SHORT_A_PLUS         0
VALIDATED_SETUPS     0
FRESH_SIGNALS        5
STALE_SIGNALS        0
ERROR_RATE           0.0%
RECONCILIATION       100.0%

A_PLUS_FOUND         NO
```

---

## Integritäts-Prüfungen

| Prüfung | Ergebnis | Status |
|--------|----------|--------|
| ICT_CANDLE_LATENCY ≥ 0 | TRUE (0 negative Werte) | ✅ PASS |
| ERROR_RATE = 0% | 0.0% | ✅ PASS |
| RECONCILIATION = 100% | 100.0% | ✅ PASS |
| Echte XAUUSD-M1-Candles | 100 Candles pro Zyklus | ✅ PASS |
| Keine Mock-Daten | Bridge BACKEND_CONNECTED | ✅ PASS |

---

## Latenz-Metriken

| Metrik | p50 | p95 | max |
|--------|-----|-----|-----|
| ICT_TICK_LATENCY | 538 ms | 752 ms | 752 ms |
| ICT_CANDLE_LATENCY | 24.5 s | – | 45.5 s |
| ICT_STRUCTURE_LATENCY | 0 ms | – | – |
| ICT_LIQUIDITY_LATENCY | 0 ms | – | – |
| ICT_SIGNAL_LATENCY | 0 ms | – | – |
| ICT_ANALYSIS_LATENCY (total) | 0 ms | 1 ms | – |

Tick-Freshness: Alle 5 Zyklen FRESH (tick_age < 5000ms).
Signal-Freshness: Alle 5 Zyklen FRESH (signal_age < 5000ms).
Structure-Version: Stabil über alle Zyklen (keine Recalculation).

---

## Per-Zyklus-Ergebnisse (LONG + SHORT)

Alle 5 Zyklen lieferten für LONG und SHORT identische Entscheidungen:

| Bedingung | LONG | SHORT |
|-----------|------|-------|
| **Decision** | WATCH | WATCH |
| **A_PLUS** | FALSE | FALSE |
| **A_PLUS Reason** | not_validated_setup | not_validated_setup |
| Liquidity Sweep | FALSE | FALSE |
| Displacement / BOS | FALSE | FALSE |
| FVG detected | TRUE | TRUE |
| Order Block | TRUE | TRUE |
| Premium/Discount | DISCOUNT | DISCOUNT |
| Killzone | OFF | OFF |
| Side Alignment | FALSE (kein BOS) | FALSE (kein BOS) |
| Entry / SL / TP1 / TP2 | null (kein VALIDATED_SETUP) | null |
| RR | null | null |
| Signal Fresh | TRUE | TRUE |
| Structure Current | TRUE | TRUE |

### Warum kein VALIDATED_SETUP / A_PLUS:

Die `evaluateDecisionState()`-Logik erfordert **alle 5 Bedingungen** gleichzeitig:
1. ✅ FVG oder OB detected (TRUE — FVG und OB beide vorhanden)
2. ❌ **Liquidity Sweep** — nicht detektiert (kein Wick über/unter Swing-Level mit Close-Rückkehr)
3. ❌ **Displacement / BOS** — nicht detektiert (kein Close über letztem Swing-High bzw. unter Swing-Low)
4. ❌ **Killzone** — OFF (19:00 UTC = vor ASIA-Killzone 20:00 UTC; London 02–05h, NY 07–10h)
5. ❌ **Side Alignment** — nicht erfüllt (BOS = NONE → keine Direction)

Da Bedingungen 2–5 fehlen, ist die Decision = WATCH (FVG/OB vorhanden, aber
kein Sweep/Displacement/Killzone). Dies ist **kein SETUP**, **kein
VALIDATED_SETUP**, und somit **kein A_PLUS**.

---

## A_PLUS_SHADOW_EVIDENCE

```
A_PLUS_SHADOW_EVIDENCE = []
```

Keine A+-Kandidaten entstanden während des Scans. Keine Shadow-Outcome-Tracking-
Daten gesammelt, da keine A+-Setups zum Tracken vorhanden.

---

## Bewertung

**A_PLUS_FOUND = NO ist ein gültiges Ergebnis.**

- Kein Threshold-Lowering durchgeführt
- Keine künstliche Setup-Konstruktion
- Keine historische/Mock-Konstruktion
- Keine Bedingung gelockert oder ergänzt
- Die eingefrorene A_PLUS-Definition wurde exakt angewendet

Die Pipeline ist funktionsfähig (REAL_XAUUSD_M1 = PASS, ERROR_RATE = 0%,
RECONCILIATION = 100%, alle Latenzen ≥ 0, alle Signale FRESH). Das Fehlen
eines A+-Setups liegt an den Marktbedingungen zum Scan-Zeitpunkt:

1. Kein Liquidity Sweep in den letzten 100 M1-Candles detektiert
2. Kein BOS (kein Close über/unter letzten Swing-Punkten)
3. Außerhalb der London/New York Killzone (19:00 UTC)

---

## Nächste Schritte (zur Entscheidung)

1. **Länger beobachten:** Scan über 30–60 Minuten während einer aktiven
   Killzone (London 02–05h UTC oder New York 07–10h UTC) wiederholen, um die
   Wahrscheinlichkeit eines A+-Setups zu erhöhen.

2. **Historischer Real-Data-Scan:** M1-Candle-Historie über mehrere Tage
   abrufen und offline mit derselben Engine auswerten, um A+-Kandidaten in
   historischen Daten zu identifizieren.

Keine automatische Aktion. Keine Code-Änderung. Keine Execution.

```
A_PLUS_FOUND         NO
ACTION_TAKEN         NONE
CODE_CHANGES         0
EXECUTION            BLOCKED
``