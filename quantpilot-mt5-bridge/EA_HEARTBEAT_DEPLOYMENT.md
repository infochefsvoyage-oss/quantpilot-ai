# EA-Heartbeat Deployment-Runbook — Windows/Vantage-Host

## Ziel

Den vollständigen Heartbeat-Path aktivieren:

```
MT5/EA → Bridge /heartbeat → QuantPilot → TICK_MONITOR
```

## Voraussetzungen

- Windows-Host mit installiertem MetaTrader 5 Terminal
- Vantage-Konto (Live oder Demo) mit Login
- Bridge erreichbar unter `https://mt5.quantpilot.cc/api/v1/mt5/heartbeat`
- Bridge API-Key (falls gesetzt) — siehe `MT5_BRIDGE_API_KEY`

## Schritt 1 — EA installieren

1. MT5 Terminal öffnen
2. `Datei → Datenordner öffnen` → `MQL5/Experts/`
3. `QuantPilotHeartbeatEA.mq5` aus `quantpilot-mt5-bridge/ea/` kopieren
4. MetaEditor öffnen → `F7` (Kompilieren)
5. EA erscheint im Navigator unter `Expert Advisors`

## Schritt 2 — EA konfigurieren

EA auf ein **XAUUSD-Chart** ziehen (D1 oder H1 — kein Einfluss auf Heartbeat).

Eingabeparameter:

| Parameter | Wert | Beschreibung |
|-----------|------|-------------|
| `BridgeUrl` | `https://mt5.quantpilot.cc/api/v1/mt5/heartbeat` | Bridge-Endpoint |
| `BridgeApiKey` | `<MT5_BRIDGE_API_KEY>` | API-Key (falls gesetzt) |
| `EaId` | `QP-EA-VANTAGE-01` | Eindeutige EA-ID |
| `EaVersion` | `1.0.0` | EA-Version |
| `HeartbeatIntervalSec` | `5` | Post-Intervall (healthy < 10s) |
| `SymbolFilter` | `XAUUSD` | Komma-separiert |

## Schritt 3 — WebRequest-Freigabe

MT5 blockiert `WebRequest()` standardmäßig. Freigabe erforderlich:

1. `Extras → Optionen → Expert Advisors`
2. ✅ `WebRequest für lange Operationen erlauben`
3. URL hinzufügen: `https://mt5.quantpilot.cc`
4. MT5 neu starten

## Schritt 4 — EA aktivieren

1. `Auto-Trading` aktivieren (Button in Toolbar)
2. EA-Smiley auf Chart bestätigen
3. Experten-Log prüfen: `Ansicht → Experten`
4. Erwartete Log-Zeile:
   ```
   [QuantPilot-Heartbeat] EA initialisiert — EaId=QP-EA-VANTAGE-01 Interval=5s
   ```
5. Nach 5s:
   ```
   [QuantPilot-Heartbeat] POST OK #1 — {"state":"HEALTHY","reason":"HEARTBEAT_HEALTHY",...}
   ```

## Schritt 5 — Heartbeat-Path verifizieren

### 5a. Bridge direkt prüfen

```bash
curl -s https://mt5.quantpilot.cc/api/v1/mt5/heartbeat \
  -H "X-API-Key: $MT5_BRIDGE_API_KEY" | jq .
```

Erwartet (nach erstem EA-POST):
```json
{
  "state": "HEALTHY",
  "reason": "HEARTBEAT_HEALTHY",
  "execution_allowed": false,
  "last_heartbeat_at": "2026-08-17T20:55:00+00:00",
  "heartbeat_age_s": 2.1,
  "ea_id": "QP-EA-VANTAGE-01",
  "version": "1.0.0"
}
```

### 5b. QuantPilot TICK_MONITOR

- Exchange-Setup-Seite öffnen
- TICK_MONITOR — XAUUSD Panel
- `HEARTBEAT_STABILITY` → steigt auf 100%
- Heartbeat-Path Diagnose → `HEARTBEAT_HEALTHY` wird CURRENT

### 5c. Backend-Funktion

```
fetchMT5Snapshot → heartbeat_state: "HEALTHY"
                 → heartbeat_reason: "HEARTBEAT_HEALTHY"
                 → heartbeat_fresh: true
                 → last_heartbeat_at: <ISO-Timestamp>
                 → heartbeat_age_s: <Sekunden>
```

## Heartbeat-Freshness-Schwellen (zentral definiert)

| Schwellenwert | Wert | Quelle |
|---------------|------|--------|
| `heartbeat_healthy_seconds` | 10s | `config.py` |
| `heartbeat_stale_seconds` | 30s | `config.py` |

| State | Bedingung | Reason |
|-------|-----------|--------|
| HEALTHY | age < 10s | `HEARTBEAT_HEALTHY` |
| WARNING | 10s ≤ age ≤ 30s | `HEARTBEAT_STALE` |
| STALE | age > 30s | `HEARTBEAT_STALE` |
| STALE | kein EA je gepostet | `EA_NOT_RUNNING` |

## Sicherheit

- **Keine Credentials** im Heartbeat-Payload (nur Login-ID als String)
- **Kein `order_send()`** — reiner Heartbeat-Path
- **Keine Lockerung** der Execution-Sperren
- `ORDER_SEND = BLOCKED`, `LIVE_EXECUTION = BLOCKED` bleiben unverändert

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| POST FAILED — HTTP 401 | API-Key fehlt/falsch | `BridgeApiKey` prüfen |
| POST FAILED — HTTP 0 err=4060 | WebRequest nicht freigegeben | Optionen → Expert Advisors → URL hinzufügen |
| POST FAILED — HTTP 0 err=4014 | URL nicht in Allowlist | `mt5.quantpilot.cc` freigeben |
| HEARTBEAT_STABILITY bleibt 0% | EA postet nicht | Experten-Log prüfen |
| `EA_NOT_RUNNING` bleibt | Bridge nicht erreichbar | Bridge-URL/Netzwerk prüfen |

## Nach erfolgreicher Aktivierung

Sobald die Bridge `HEARTBEAT_HEALTHY` meldet:
1. 10–15-Minuten-Stabilitätstest läuft automatisch im TICK_MONITOR
2. p50/p95/p99 werden über reale XAUUSD-Ticks gemessen
3. AuditLog `READ_ONLY_PERFORMANCE_TEST` wird mit echten Messwerten aktualisiert
4. Performance-Status wird nur bei echten PASS-Werten auf `PERFORMANCE_PASS` gesetzt