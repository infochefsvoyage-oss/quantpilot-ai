# QuantPilot AI – OP-777 Sniper Desk

> Privater KI-gestützter Trading-Desk für Binance & MEXC
> **Kapitalerhalt hat Vorrang. Daily Profit ist ein Ziel-KPI, kein Versprechen.**

---

## ⚠️ Wichtiger Hinweis – Kein Gewinnversprechen

**Täglicher Gewinn kann NICHT garantiert werden.** „Daily Profit" ist eine Ziel-KPI, kein Versprechen. Die Märkte sind unberechenbar, und selbst A+ Setups können zu Verlusten führen. QuantPilot AI wurde mit einer klaren Priorität entwickelt:

1. **Kapitalerhalt** (Capital Preservation First)
2. Risikobegrenzung
3. Konsistente, disziplinierte Ausführung
4. Langfristiger Ertrag

Trading birgt das Risiko des Totalverlusts. Setzen Sie nur Kapital ein, dessen Verlust Sie sich leisten können.

---

## Architektur

### Stack
| Komponente | Technologie |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Datenbank | PostgreSQL (Trades, Audit, Settings, Journal) |
| Live-Events | Redis (Pub/Sub) |
| Candle-/Tick-Daten | InfluxDB |
| Deployment | Docker Compose |

### Module (10)
1. **ASCAN Signal Engine** – A+ Setup Erkennung
2. **ULF Governance Engine** – Freigabe-Workflow
3. **Risk Engine** – Risikobegrenzung & Kapitalerhalt
4. **Portfolio Engine** – Exposure-Überwachung
5. **Money-Management Engine** – TP1/TP2/TP3 Verwaltung
6. **Exchange Router** – Binance & MEXC Adapter
7. **Audit Log** – Vollständige Nachvollziehbarkeit
8. **Daily Performance Journal** – Tägliche Reflexion
9. **Telegram/Desktop Notification Service** – Benachrichtigungen
10. **Backtest & Replay Engine** – Strategie-Validierung

---

## Installation

### Voraussetzungen
- Docker & Docker Compose
- Node.js 20+ (für Frontend-Entwicklung)
- Python 3.11+ (für Backend-Entwicklung)

### 1. Repository klonen
```bash
git clone <repository-url>
cd quantpilot-ai
```

### 2. Environment Variablen einrichten
```bash
cp .env.example .env
# Alle Secrets in .env eintragen – NIEMALS API-Secrets ins Frontend!
```

### 3. Docker Compose starten
```bash
docker-compose up -d
```

Das startet folgende Services:
- `api` (FastAPI Backend, Port 8000)
- `frontend` (React Frontend, Port 3000)
- `postgres` (Datenbank, Port 5432)
- `redis` (Event-Stream, Port 6379)
- `influxdb` (Zeitreihen-Daten, Port 8086)
- `nginx` (Reverse Proxy, Port 80)

### 4. Frontend (Entwicklung)
```bash
cd frontend
npm install
npm run dev
```

### 5. Backend (Entwicklung)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## Paper Mode starten

Der Paper Mode ist der Standard-Modus und immer verfügbar. Keine API-Secrets für echtes Trading erforderlich.

1. Dashboard öffnen → Modus zeigt **PAPER**
2. Exchange Setup → Binance **Testnet/Paper** aktivieren
3. Sniper Mode → Signale werden gescannt und können als Paper-Trades ausgeführt werden
4. Portfolio → Paper-Trades werden getrackt, aber es fließt kein echtes Kapital

---

## Binance Testnet verbinden

1. **Binance Testnet API Keys erstellen:**
   - Gehe zu: https://testnet.binancefuture.com
   - Erstelle API Key + Secret

2. **API Keys sicher speichern:**
   - In `.env` eintragen (nicht ins Frontend!):
   ```env
   BINANCE_TESTNET_API_KEY=your_testnet_key
   BINANCE_TESTNET_API_SECRET=your_testnet_secret
   ```

3. **Im Exchange Setup:**
   - Binance Adapter → „Testnet Verbinden" klicken
   - Phase 1 wird aktiviert
   - API Keys werden AES-256 verschlüsselt in PostgreSQL gespeichert

4. **Paper-Trading testen:**
   - Sniper Mode → A+ Signale werden angezeigt
   - Paper Orders erstellen → keine echten Trades

---

## MEXC als Scan-Modul aktivieren

MEXC wird initial **nur als Scan- und Paper-Modul** verwendet. Live-Trading erst nach separater Governance-Freigabe.

1. Exchange Setup → MEXC Adapter
2. „Scan-Modul aktivieren" klicken
3. MEXC scannt Symbole auf A+ Setups, führt aber keine echten Trades aus
4. MEXC Live-Trading: Erst nach **expliziter Governance-Freigabe** (Phase 4)

---

## Governance-Freigabe

Live-Trading ist **standardmäßig deaktiviert**. Folgende Aktionen benötigen Freigabe:

| Aktion | Beschreibung |
|---|---|
| `LIVE_TRADE` | Live-Trading aktivieren |
| `PAPER_TO_LIVE` | Von Paper zu Live migrieren |
| `RISK_INCREASE` | Risiko pro Trade erhöhen |
| `LEVERAGE_INCREASE` | Leverage erhöhen |
| `EXCHANGE_KEY_ACTIVATION` | API-Key aktivieren |
| `DISABLE_STOP_LOSS` | Stop-Loss deaktivieren |
| `MAX_POSITIONS_INCREASE` | Max. offene Positionen erhöhen |
| `STRATEGY_SWITCH` | Strategie wechseln |
| `EMERGENCY_OVERRIDE` | Emergency Override |

### Freigabe-Workflow
1. Operator stellt Antrag (Prepare-Action) mit Begründung
2. Governance-Seite zeigt Pending Action
3. Operator gibt PIN ein und bestätigt (Approve) oder lehnt ab (Reject)
4. Audit Log protokolliert jede Aktion mit Timestamp
5. System schaltet erst nach Approval in den neuen Modus

---

## ASCAN A+ Setup

Ein Trade darf nur entstehen, wenn **alle 4 Pflichtgatter** erfüllt sind:

1. ✅ **Liquidity Sweep**
2. ✅ **Reclaim oder Rejection**
3. ✅ **Volume Confirmation**
4. ✅ **HTF Alignment**

### Mindestwerte
- ASCAN Score ≥ 75
- RR ≥ 2.5
- Spread innerhalb Limit
- Funding akzeptabel
- Daten frisch
- Stop Loss vorhanden

### Decision States
| State | Bedeutung |
|---|---|
| `ENTER` | Alle Gates erfüllt – Trade erlaubt |
| `ENTER_REDUCED` | A+ mit Einschränkung – reduzierte Position |
| `WATCH_ONLY` | Gates nicht vollständig – nur beobachten |
| `NO_TRADE` | Kein A+ Setup – kein Trade |

**Standard:** Wenn ein Gater fehlt, muss `WATCH_ONLY` oder `NO_TRADE` ausgegeben werden.

---

## Risiko & Kapitalerhalt

### Risk Defaults
| Parameter | Wert |
|---|---|
| Risk Level | LEVEL_2 |
| Risiko pro Trade | 0.50% |
| Max. offene Positionen | 1 |
| Portfolio Exposure Cap | 10% |
| Tagesverlust-Limit | 1.50% |
| Wochenverlust-Limit | 4.00% |
| Max Drawdown Pause | 6.00% |
| Capital Priority | CAPITAL_PRESERVATION_FIRST |
| High Leverage Mode | DISABLED |

### Money Management
- **TP1:** 40% schließen, Stop auf Break-even
- **TP2:** 30% schließen, Trailing Stop aktivieren
- **TP3:** 30% Runner oder vollständiger Exit

### Automatische Schutzregeln
- Nach 2 Verlusttrades am Tag → Risiko halbieren
- Nach Tagesverlustlimit (1.50%) → Trading pausieren
- Nach Max Drawdown (6.00%) → Trading komplett stoppen
- Nach Tagesziel (2.0%) → Risiko reduzieren oder Trading beenden
- **Kein Forced Trading** – kein Trade ohne A+ Setup

---

## Sicherheitsregeln

- ✅ Keine API-Secrets im Frontend
- ✅ Secrets nur über Environment Variables
- ✅ API Keys AES-256 verschlüsselt gespeichert
- ✅ Testnet/Paper zuerst
- ✅ Kein Live-Trading ohne explicit governance approval
- ✅ Order-Reconciliation nach Timeout
- ✅ Rate-Limit Backoff pro Exchange
- ✅ Circuit Breaker bei Datenfehlern (3 Fehler → 60s Pause)
- ✅ Emergency Stop blockiert alle neuen Trades

---

## API-Routen

```
GET  /health
GET  /runtime/status
GET  /market/snapshot/{symbol}
POST /ascan/evaluate
POST /risk/calculate
POST /portfolio/check
POST /paper/order
POST /shadow/order
POST /governance/prepare-action
POST /governance/approve
POST /governance/reject
GET  /governance/pending
GET  /audit/logs
GET  /journal/daily
POST /safety/emergency-stop
```

---

## Frontend-Seiten

| Seite | Route | Beschreibung |
|---|---|---|
| Dashboard | `/` | Übersicht – Modus, Status, PnL, Gates, Warnungen |
| Sniper Mode | `/sniper` | A+ Setup Erkennung & Order-Ticket |
| Portfolio | `/portfolio` | Exposure & offene Positionen |
| Risiko | `/risk` | Risk Engine & Limits |
| Governance | `/governance` | Freigabe-Workflow |
| Journal | `/journal` | Daily Performance Journal |
| Exchange Setup | `/exchange` | Binance & MEXC Konfiguration |
| Backtest | `/backtest` | Strategie-Backtest & Replay |
| Live Feed | `/live-feed` | Echtzeit-Event-Stream |
| Einstellungen | `/settings` | Notifications & Sicherheit |

---

## .env Beispiel

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=quantpilot
POSTGRES_USER=quantpilot
POSTGRES_PASSWORD=change_me

# Redis
REDIS_URL=redis://localhost:6379

# InfluxDB
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=change_me
INFLUXDB_ORG=quantpilot
INFLUXDB_BUCKET=candles

# Binance Testnet (Phase 1)
BINANCE_TESTNET_API_KEY=your_testnet_key
BINANCE_TESTNET_API_SECRET=your_testnet_secret

# MEXC (Scan-Modul)
MEXC_API_KEY=your_mexc_key
MEXC_API_SECRET=your_mexc_secret

# Encryption
API_KEY_ENCRYPTION_KEY=change_me_32_bytes

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Governance
GOVERNANCE_PIN=change_me
```

---

## Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis, influxdb]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [api]

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: quantpilot
      POSTGRES_USER: quantpilot
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  influxdb:
    image: influxdb:2
    ports: ["8086:8086"]
    volumes: ["influxdata:/var/lib/influxdb2"]

  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    depends_on: [frontend, api]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]

volumes:
  pgdata:
  influxdata:
```

---

## Tests

### Backend (Pytest)
```bash
cd backend
pytest tests/ -v
```

### Frontend (E2E)
```bash
cd frontend
npx playwright test
```

---

## Phasen-Übersicht

| Phase | Exchange | Modus | Governance |
|---|---|---|---|
| Phase 1 | Binance | Testnet/Paper | — |
| Phase 2 | Binance | Shadow | Erforderlich |
| Phase 3 | Binance | Live | Erforderlich |
| Phase 4 | MEXC | Scan/Paper → Live | Erforderlich |

---

## Lizenz & Haftungsausschluss

Diese Software ist für private Nutzung bestimmt. Sie ist keine Anlageberatung. Der Autor übernimmt keine Haftung für Verluste, die durch die Nutzung dieser Software entstehen. Trading mit Kryptowährungen birgt erhebliche Risiken bis hin zum Totalverlust.

**Kapitalerhalt hat Vorrang. Daily Profit ist ein Ziel-KPI, kein Versprechen.**