# MT5_INTEGRATION_TEST_REPORT.md

**Scope:** Vantage (Broker) → MetaTrader 5 (Platform) → EA (Execution Adapter) → QuantPilot (Strategy/Risk/Governance)

**Grundsatz:** MT5 ist KEINE Exchange. Trennung von Broker, Plattform, Execution-Adapter und Strategie.
Live-Execution bleibt per Default BLOCKED. Keine Mock-Daten als Live-Daten.

**Datum:** 2026-08-09

---

## Architektur

```
VANTAGE → MetaTrader 5 → (Market Feed | Account) → QUANTPILOT
QUANTPILOT = ICT Scanner + Risk Engine + Governance → PAPER → EA ARM → LIVE ORDER
```

- `broker = VANTAGE`
- `platform = MT5`
- `integration = METAQUOTES`
- Default: `execution_mode = PAPER`, `ea_enabled = false`, `live_execution_blocked = true`

---

## Testergebnisse

| #  | Prüfpunkt                  | Status   | Hinweis                                                        |
|----|----------------------------|----------|----------------------------------------------------------------|
| 1  | Frontend (ExchangeSetup)   | PASS     | MetaTraderPanel integriert, Binance/MEXC unangetastet           |
| 2  | Datenmodell (MT5Connection)| PASS     | Entity angelegt, Broker/Plattform/Integration getrennt          |
| 3  | MT5 Connection             | BLOCKED  | Status DISCONNECTED – wartet auf Backend-Bridge                |
| 4  | Account Read               | BLOCKED  | account_id/server leer – Read-only-Test über Backend ausstehend|
| 5  | Market Data                | BLOCKED  | Kein Tick-Feed – Backend-Anbindung ausstehend                  |
| 6  | Symbol Mapping             | WARNING  | Kandidaten definiert, validated=false – Feed-Validierung offen|
| 7  | EA Heartbeat               | BLOCKED  | ea_status=NOT_INSTALLED – Heartbeat-Logik im Backend nötig      |
| 8  | Position Sync              | BLOCKED  | Keine Positionen – Backend-Sync ausstehend                     |
| 9  | Paper Order                | BLOCKED  | EA nicht armed – Gates offen                                   |
| 10 | Duplicate Protection       | PASS     | Gate `duplicate_clear` + magic_number/client_order_id vorgesehen|
| 11 | Risk Gate                  | PASS     | Bestehende Risk Engine genutzt, nicht dupliziert (0,5% / 1 Pos) |
| 12 | Governance Gate            | PASS     | Live-Order nur mit Governance-Hash, sonst BLOCKED               |
| 13 | Emergency Stop             | PASS     | Kill-Switch blockiert neue Orders + EA, schließt Positionen nicht|
| 14 | Stale Data                 | PASS     | Gate `data_fresh` blockt EA bei altem Feed                     |
| 15 | Connection Loss            | PASS     | Heartbeat-Timeout → HEARTBEAT_LOST → LIVE BLOCKED              |
| 16 | EA Disconnect              | PASS     | ea_status=OFFLINE/HEARTBEAT_LOST → keine neuen Orders          |

---

## Security

- Keine Zugangsdaten im Frontend
- Keine Passwörter/API-Keys in React
- Secrets ausschließlich über Backend/Environment
- Account-ID und Server nur referenziert

---

## Go-Live Bedingungen

- [ ] MT5 Read-only Test
- [ ] Symbol Mapping validiert (XAUUSD, BTCUSD)
- [ ] EA Heartbeat stabil
- [ ] Market Feed stabil
- [ ] Account Sync stabil
- [ ] Paper Trading
- [ ] 24h Shadow
- [ ] Risk Test
- [ ] Governance Test
- [ ] Emergency Stop Test
- [ ] Duplicate Order Test

---

## Empfehlung

**NO-GO**

Begründung: Frontend- und Datenmodell-Schicht stehen. Alle Live-relevanten Pfade
(MT5-Verbindung, Account-Read, Market-Data, EA-Heartbeat, Position-Sync) sind
BLOCKED, da die externe FastAPI/MT5-Bridge noch nicht angebunden ist.
Kein automatisches Aktivieren. Nach Backend-Anbindung erneut: GO-LIVE TEST.

**Keine bestehende QuantPilot-Funktion entfernt. Keine Live-Execution aktiviert.**