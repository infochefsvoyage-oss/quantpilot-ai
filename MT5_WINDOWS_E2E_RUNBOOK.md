# MT5 Windows E2E Runbook

**Version:** 1.0
**Datum:** 2026-08-16
**Ziel:** Echten End-to-End-Verbindungsbeweis `QuantPilot → FastAPI → MetaTrader5 Python API → Vantage MT5 Terminal` auf dem Windows-Host erbringen.
**Ausführungsort:** Windows-PC mit installiertem Vantage MT5 Terminal. **Nicht** in der Base44-App.

> **Eiserne Regel:** Ohne erfolgreichen Lauf dieses Runbooks auf einem echten Windows/MT5-Host
> darf der Status **NIEMALS** `MT5_E2E_CONNECTED` werden. Keine Simulation. Keine Defaultwerte
> als PASS. Kein persistierter UI-Datensatz als E2E-Beweis.

---

## Voraussetzungen (vor dem Start)

| # | Voraussetzung | Prüfung |
|---|---|---|
| 1 | Windows 10/11 PC | `winver` |
| 2 | Vantage MT5 Terminal installiert | Desktop-Icon vorhanden |
| 3 | Vantage Live-Account (Login + Passwort) | Nur auf Windows, niemals ins Git |
| 4 | Python 3.11 installiert (NICHT 3.14 – inkompatibel mit MetaTrader5) | `python --version` |
| 5 | Git installiert | `git --version` |
| 6 | Keine Secrets im Repository | siehe Pre-Flight Check §6 |
| 7 | `.env` in `.gitignore` (Bridge + Root) | siehe Pre-Flight Check §6 |

---

## Schritt-für-Schritt Anleitung

### Schritt 1 – Repository klonen/pullen

```powershell
cd C:\quantpilot
git clone <repo-url> quantpilot-ai
cd quantpilot-ai
git pull origin main
```

**Prüfung:** `git status` zeigt "up to date", kein `.env` im Staging.

### Schritt 2 – Python-Version prüfen

```powershell
python --version
```

**Erwartet:** `Python 3.11.x`. Wenn 3.14 → Downgrade auf 3.11 (MetaTrader5-Paket inkompatibel).

### Schritt 3 – Virtuelle Umgebung erstellen

```powershell
cd quantpilot-mt5-bridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Prüfung:** Prompt zeigt `(.venv)`.

### Schritt 4 – Bridge-Dependencies installieren

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

**Prüfung:** `pip list` zeigt `fastapi`, `uvicorn`, `pydantic`, `MetaTrader5`.

### Schritt 5 – MetaTrader5 Python-Paket installieren

```powershell
pip install MetaTrader5
```

**Prüfung:**
```powershell
python -c "import MetaTrader5 as mt5; print('MT5 package OK', mt5.__version__ if hasattr(mt5,'__version__') else 'loaded')"
```
**Erwartet:** `MT5 package OK ...`. Wenn `ModuleNotFoundError` → Python-Version prüfen (muss 3.11).

### Schritt 6 – Vantage MT5 Terminal öffnen

1. Vantage MT5 Desktop-Terminal starten.
2. Warten bis Terminal vollständig geladen.

### Schritt 7 – Vantage Account einloggen

1. Im MT5 Terminal: `File → Login to Trade Account`.
2. Login + Passwort + Server eingeben.
3. Einloggen.
4. Prüfen: Account-Balance sichtbar, Status "Connected".

### Schritt 8 – Server aus `account_info()` feststellen

```powershell
python -c "import MetaTrader5 as mt5; mt5.initialize(); ai=mt5.account_info(); print('SERVER:', ai.server, '| LOGIN:', '****'+str(ai.login)[-4:]); mt5.shutdown()"
```

**Erwartet:** `SERVER: VantageMarkets-Live ... | LOGIN: ****XXXX`.
**Wichtig:** Server in `MT5_ALLOWED_SERVERS` env-Variable aufnehmen, falls abweichend.

### Schritt 9 – `.env` konfigurieren (nur lokal, niemals committen)

```powershell
copy .env.example .env
notepad .env
```

**Inhalte eintragen:**
```env
MT5_LOGIN=<vantage_login>
MT5_PASSWORD=<vantage_password>
MT5_SERVER=<server_aus_schritt_8>
MT5_BRIDGE_PORT=8000
MT5_BRIDGE_API_KEY=<beliebiger_key>
LIVE_EXECUTION_ENABLED=false
EA_ENABLED=false
MT5_ALLOWED_SERVERS=VantageMarkets-Live,VantageMarkets-Demo,VantageInternational-Live,VantageInternational-Demo,VantageGlobal-Live,VantageGlobal-Demo
```

**Prüfung:** `git status` zeigt `.env` NICHT (gitignored).

### Schritt 10 – Bridge starten

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Prüfung:** Konsole zeigt `Uvicorn running on http://127.0.0.1:8000`. Terminal offen lassen.

### Schritt 11 – `/health` prüfen (neues Terminal)

```powershell
$env:MT5_BRIDGE_API_KEY="<key_aus_env>"
curl http://127.0.0.1:8000/api/v1/mt5/health -H "X-API-Key: $env:MT5_BRIDGE_API_KEY"
```

**Erwartet:** `{"status":"ok","bridge":true,...}`.

### Schritt 12 – `/verification` prüfen

```powershell
curl http://127.0.0.1:8000/api/v1/mt5/verification -H "X-API-Key: $env:MT5_BRIDGE_API_KEY"
```

**Erwartet:** `"tier":"MT5_E2E_CONNECTED"` (wenn MT5 läuft + eingeloggt). Wenn `BACKEND_CONNECTED` → MT5 nicht bewiesen, weiter debuggen.

### Schritt 13 – `e2e_probe.py` ausführen (Output automatisch speichern)

```powershell
cd quantpilot-mt5-bridge
$env:MT5_BRIDGE_URL="http://127.0.0.1:8000/api/v1/mt5"
$env:MT5_BRIDGE_API_KEY="<key_aus_env>"
python e2e_probe.py | Tee-Object -FilePath e2e_probe_windows_output.txt
```

**Der Output wird automatisch in `e2e_probe_windows_output.txt` gespeichert.**

### Schritt 14 – Vollständigen Output speichern und prüfen

```powershell
type e2e_probe_windows_output.txt
```

**Erwarteter finaler Block (bei Erfolg):**
```
==============================
MT5 E2E FINAL RESULT
==============================
PASSED: 14/14
FAILED: 0/14
ORDER_CHECK: PASS
ORDER_SEND: BLOCKED
LIVE_EXECUTION: BLOCKED
BROKER_COMPANY: Vantage
SERVER: VantageMarkets-Live
SYMBOL: XAUUSD
VERDICT: MT5_E2E_CONNECTED
==============================
```

**Bei Misserfolg:**
```
==============================
MT5 E2E FINAL RESULT
==============================
PASSED: X/14
FAILED: X/14
ORDER_CHECK: FAIL
ORDER_SEND: BLOCKED
LIVE_EXECUTION: BLOCKED
BROKER_COMPANY: ...
SERVER: ...
SYMBOL: ...
VERDICT: MT5_E2E_NOT_VERIFIED
==============================
```

---

## Post-Run: Status ins Frontend übernehmen

**Nur wenn** der Output `VERDICT: MT5_E2E_CONNECTED` zeigt:

1. `e2e_probe_windows_output.txt` ins Repository kopieren (oder Inhalt dokumentieren).
2. `MT5Connection`-Entity in der Base44-App aktualisieren:
   - `verification_tier`: `MT5_E2E_CONNECTED`
   - `connection_status`: `CONNECTED`
   - `login_status`: `LOGGED_IN`
   - `ea_status`: `OFFLINE` oder `CONNECTED` (nicht `ARMED` ohne Governance)
   - `last_heartbeat`: aktueller ISO-Timestamp
   - `live_execution_blocked`: bleibt `true` (Live bleibt BLOCKED bis Phase D)
3. AuditLog-Eintrag erstellen: `event: "MT5_E2E_VERIFIED"`, `category: "SECURITY"`.

**Wenn `VERDICT: MT5_E2E_NOT_VERIFIED`:** Status bleibt `BACKEND_CONNECTED` oder `UI_CONTRACT`. Keine Hochstufung.

---

## Sicherheits-Checkliste (vor jedem Lauf)

| # | Check | Befehl |
|---|---|---|
| 1 | Keine Secrets im Git | `git log --all -p \| grep -iE "password\|api_key\|secret"` (sollte leer sein) |
| 2 | `.env` in `.gitignore` | `git check-ignore .env` (sollte `.env` ausgeben) |
| 3 | `order_send()` nicht erreichbar | `grep -rn "order_send" app/` (nur in guards/tests, nie aktiv) |
| 4 | `/orders/execute` bleibt BLOCKED | Probe-Output: `ORDER_SEND: BLOCKED` |
| 5 | Keine Frontend-Credentials | `grep -rn "password\|login\|api_key" src/` (nur referenziert, nie Klartext) |
| 6 | `LIVE_EXECUTION_ENABLED=false` | `grep LIVE_EXECUTION_ENABLED .env` |

---

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---|---|---|
| `ModuleNotFoundError: MetaTrader5` | Python 3.14 oder Paket fehlt | Python 3.11 installieren, `pip install MetaTrader5` |
| `MT5_TERMINAL_UNAVAILABLE` | MT5-Terminal nicht offen | Schritt 6 wiederholen |
| `account_info None` | Nicht eingeloggt | Schritt 7 wiederholen |
| `server not in allowlist` | Server-Name abweichend | `MT5_ALLOWED_SERVERS` in `.env` erweitern |
| FastAPI nicht erreichbar | Bridge nicht gestartet | Schritt 10 prüfen |
| `ORDER_SEND: NOT BLOCKED` | Kill-Switch deaktiviert | `LIVE_EXECUTION_ENABLED=false` in `.env` setzen |
| `XAUUSD Symbol Discovery FAIL` | Symbol nicht im Market Watch | Im MT5: `View → Market Watch`, XAUUSD hinzufügen |

---

## Finaler Verdict

| Bedingung | Verdict |
|---|---|
| Alle 14 Checks PASS + `ORDER_SEND: BLOCKED` | `MT5_E2E_CONNECTED` |
| ≥1 Check FAIL oder `ORDER_SEND: NOT BLOCKED` | `MT5_E2E_NOT_VERIFIED` |
| Windows/MT5 nicht ausgeführt | `MT5_E2E_NOT_VERIFIED` (keine Simulation) |

**Keine Simulation. Keine Defaultwerte als PASS. Keine persistierten UI-Daten als E2E-Beweis.**

---

*© QuantPilot AI — OP-777 Sniper Desk. Vertraulich. Geschützte Kern-IP.*