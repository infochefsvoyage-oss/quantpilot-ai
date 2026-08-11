# QuantPilot MT5 Bridge

Echte FastAPI-Bridge für Vantage / MetaTrader 5. **Keine Simulation.**
Live-Execution ist technisch blockiert (`MT5_LIVE_EXECUTION=false`, `/orders/execute` → `BLOCKED`).

## Status
- `UI_CONTRACT` ✅ (Vertrag + Frontend)
- `BACKEND_CONNECTED` ❌ nicht nachgewiesen
- `MT5_E2E_CONNECTED` ❌ nicht nachgewiesen

Erst ein erfolgreicher `e2e_probe.py` auf dem MT5-Rechner darf den Status auf `MT5_E2E_CONNECTED` setzen.

## Architektur
```
QuantPilot → HTTPS + API-Key → FastAPI → MetaTrader5 (Python) → MT5 Terminal → Vantage
```
Frontend spricht **niemals** direkt mit MT5. Credentials nur im Backend `.env`.

## Setup (auf dem MT5/Vantage-Rechner)
```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
pip install -e .
copy .env.example .env   # echte Werte eintragen, NIEMALS committen
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Endpoints (`/api/v1/mt5`)
| Method | Path | Zweck |
|---|---|---|
| GET | `/health` | Bridge-Health (UI_CONTRACT bis E2E bewiesen) |
| GET | `/connection` | Verbindungsstatus + Tier |
| GET | `/account` | account_info() – keine Credentials |
| GET | `/symbols/{symbol}` | Symbol-Discovery + echte MT5-Spec |
| GET | `/positions` | positions_get() + orders_get() (Duplicate Guard) |
| POST | `/heartbeat` | EA-Heartbeat (HEALTHY/WARNING/STALE) |
| POST | `/orders/validate` | Echte Prüfung inkl. `order_check()` – keine Order |
| POST | `/orders/execute` | **BLOCKED** – Kill-Switch |

## Sicherheitsregeln
- `WARNING` oder `STALE` → Execution BLOCKED (nur `HEALTHY` erlaubt).
- Doppelte Kill-Switches: `MT5_LIVE_EXECUTION=false` + `ENVIRONMENT!=production`.
- Keine Passwörter/Secrets in Logs, Responses oder Git.
- `order_check()` sendet keine Order.

## E2E-Test
```bash
python e2e_probe.py
```
12 Prüfungen. Nur wenn alle `PASS` → `VERDICT: MT5_E2E_CONNECTED`.

## Tests (ohne MT5)
```bash
pytest tests/
``