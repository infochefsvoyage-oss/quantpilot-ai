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

### Module (13)
1. **ASCAN Signal Engine** – A+ Setup Erkennung, Setup-Scoring, Exposure-Kontrolle, Trade-Gates
2. **ULF Governance Engine** – Operator-Governance, Freigabe-Workflow, Runner-Schutz, Safety-Layer, Audit-Logik
3. **Risk Engine** – Risikobegrenzung & Kapitalerhalt (Capital Preservation First)
4. **Portfolio Engine** – Exposure-Überwachung
5. **Money-Management Engine** – TP1/TP2/TP3 Verwaltung
6. **Exchange Router** – Binance & MEXC Adapter via CCXT (mit SOCKS5-Proxy-Support)
7. **Audit Log** – Vollständige Nachvollziehbarkeit
8. **Daily Performance Journal** – Tägliche Reflexion
9. **Telegram/Desktop Notification Service** – Benachrichtigungen & Alerts
10. **Backtest & Replay Engine** – Strategie-Validierung
11. **ARB-Scan Engine** – Multi-Exchange Arbitrage-Scanner, Regime-Erkennung, Spread/ Kostenanalyse, Netto-Chancen-Alerting
12. **Runner-Protection Engine** – Dynamische Trailing-Stops, Break-Even-Management, Teilgewinn-Logik, Volatilitätsbasierte Stop-Anpassung, Telegram-Alerts
13. **Reverse-Short Playbook** – Short-Strategien, Reversal-Logik, Liquiditäts-Sweeps, Runner-Exit-Strategien, Trailing-Stop-Management

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
| `PROXY_SWITCH` | Proxy-Wechsel (SOCKS5) |
| `RUNNER_ADOPTION` | Runner-Adoption (z. B. XRP) |
| `ARB_EXECUTION` | ARB-Ausführung |
| `REVERSE_SHORT_EXECUTION` | Reverse-Short Ausführung |
| `SAFETY_DEACTIVATION` | Schutzmechanismus deaktivieren |

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

## ARB-Scan – Multi-Exchange Arbitrage

Der ARB-Scanner spricht mehrere Börsen über **CCXT** an (Binance, MEXC, Bybit, OKX).

### Funktionen
- **Spread-Erkennung** zwischen Exchanges in Echtzeit
- **Kostenanalyse**: Taker-Gebühren, Slippage-Schätzung, Funding-Kosten
- **Markt-Regime-Klassifizierung**: CALM, VOLATILE, TRENDING, ILLIQUID, EXTREME
- **Netto-Chancen-Filter**: Nur Opportunities nach Kosten werden gemeldet
- **Telegram-Alerts** bei wirtschaftlich relevanten Chancen (Netto > 0.1%)
- **Keine automatische Ausführung** – Governance-Freigabe erforderlich

### Regime-basierte Filterung
| Regime | Beschreibung | Trading-Verhalten |
|---|---|---|
| CALM | Stabil, niedrige Volatilität | Standard-Scanning |
| VOLATILE | Hohe Volatilität | Erhöhte Slippage-Schätzung |
| TRENDING | Gerichteter Trend | Bevorzugte ARB-Chancen |
| ILLIQUID | Geringe Liquidität | ARB pausiert (Slippage-Risiko) |
| EXTREME | Extreme Bedingungen | Trading pausiert, Circuit Breaker |

### Workflow
1. CCXT pollt Orderbooks aller verbundenen Exchanges
2. Spread-Berechnung für jedes Symbol-Paar
3. Kostenabzug (Gebühren + Slippage + Funding)
4. Nur Netto-profitable Opportunities → Telegram-Alert
5. Governance-Freigabe über `POST /governance/approve` mit `action_type: ARB_EXECUTION`
6. Paper-Ausführung im Standard, Live nur nach separater Freigabe

---

## Runner-Protection

Implementiert Runner-Protection für adoptierbare Coins (initial: **XRP**).

### Funktionen
- **Dynamische Trailing-Stops** – ATR-basierte Stop-Anpassung
- **Break-Even-Management** – Stop auf Entry nach TP1
- **Teilgewinn-Logik** – TP1 40% / TP2 30% / TP3 30% Runner
- **Volatilitätsbasierte Stop-Anpassung** – ATR < 3% = normal, ATR ≥ 3% = Tightening
- **Telegram-Alerts** bei jedem TP-Hit, Stop-Adjustment und Adoption
- **Audit-Logs** für jede Runner-Entscheidung

### Stop-Anpassungs-Modi
| Modus | Beschreibung |
|---|---|
| FIXED | Starrer Stop (nur Initial) |
| ATR_BASED | Stop folgt Preis mit ATR-Abstand |
| TIGHTENING | Stop zieht enger bei steigender Volatilität |
| BREAK_EVEN | Stop auf Entry-Level nach TP1 |

### Adoption-Workflow
1. Signal erreicht TP1 → Runner-Kandidat identifiziert
2. Adoption erfordert **Governance-Freigabe** (`RUNNER_ADOPTION`)
3. Nach Freigabe: Break-Even aktiviert, Trailing-Stop gesetzt
4. TP2/TP3 werden automatisch verfolgt
5. Jede Anpassung → Telegram-Alert + Audit-Log

---

## Reverse-Short Playbook

Short-Strategien basierend auf Reversal-Logik und Liquiditäts-Sweeps.

### Reversal-Typen
| Typ | Trigger | Min. Score | Min. RR | Exit |
|---|---|---|---|---|
| Liquidity Sweep Reversal | Sweep über Key Level + Rejection | 75 | 2.5 | Trailing Runner |
| Fakeout Reversal | False Breakout + Volume Drop + Reclaim | 70 | 2.0 | Partial Runner |
| HTF Rejection Reversal | D1/W1 Level Reject + LTF Confirmation | 78 | 3.0 | Trailing Runner |
| Exhaustion Reversal | 3+ Pushes + Divergence + Sweep | 72 | 2.5 | Break-Even Runner |
| Double Top Reversal | Equal Highs + Lower High + Volume | 68 | 2.0 | Full Exit TP3 |

### Validierungs-Gates (alle müssen PASS für ENTER_SHORT)
1. ✅ **Liquidity Sweep erkannt**
2. ✅ **Sweep-Richtung** (UPWARD_SWEEP für Short)
3. ✅ **Volume Confirmation**
4. ✅ **HTF Alignment** (SHORT Bias)

### Runner-Exit-Strategien
- **FULL_EXIT_TP3** – Kompletter Exit am TP3
- **TRAILING_RUNNER** – 30% Runner mit Trailing Stop
- **PARTIAL_RUNNER** – 15% Runner, 15% fix am TP3
- **BREAK_EVEN_RUNNER** – Restposition mit Break-Even Stop

---

## SOCKS5-Proxy-Integration

Binance USDM-Anfragen aus EU-Regionen benötigen SOCKS5-Proxy-Unterstützung.

### Konfiguration
```env
# .env
SOCKS5_PROXY_HOST=127.0.0.1
SOCKS5_PROXY_PORT=1080
SOCKS5_PROXY_USERNAME=optional
SOCKS5_PROXY_PASSWORD=optional

# Proxy-Wechsel erfordert Governance-Freigabe
GOVERNANCE_PROXY_SWITCH_REQUIRED=true
```

### Implementation (Backend)
```python
# backend/exchange/proxy_manager.py
import socks
import socket

class ProxyManager:
    def __init__(self, host, port, username=None, password=None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password

    def get_proxied_session(self):
        # CCXT mit SOCKS5 Proxy
        session = socks.socksocket()
        session.set_proxy(socks.SOCKS5, self.host, self.port,
                          username=self.username, password=self.password)
        return session
```

### Governance-Regel
- Proxy-Wechsel (`PROXY_SWITCH`) erfordert Governance-Freigabe
- Bei Proxy-Ausfall: Fail-Safe → Paper-Modus, keine Live-Trades
- Proxy-Status wird im Exchange Setup angezeigt

---

## CCXT Exchange-Anbindung

```python
# backend/exchange/ccxt_router.py
import ccxt.async_support as ccxt
from backend.governance import require_approval

class ExchangeRouter:
    def __init__(self):
        self.exchanges = {
            'binance': ccxt.binanceusdm({'apiKey': ..., 'secret': ...}),
            'mexc': ccxt.mexc({'apiKey': ..., 'secret': ...}),
            'bybit': ccxt.bybit({'apiKey': ..., 'secret': ...}),
            'okx': ccxt.okx({'apiKey': ..., 'secret': ...}),
        }

    async def scan_orderbooks(self, symbols):
        """Scannt Orderbooks aller Exchanges für ARB-Opportunities."""
        results = {}
        for name, exchange in self.exchanges.items():
            for symbol in symbols:
                try:
                    ob = await exchange.fetch_order_book(symbol)
                    results[(name, symbol)] = ob
                except ccxt.RateLimitExceeded:
                    await exchange.sleep(200)  # Backoff
        return results
```

---

## Backend-Architektur (FastAPI – Separates Repository)

> ⚠️ **Wichtig**: Das FastAPI-Backend wird in einem separaten Repository betrieben.
> Diese Base44-App liefert das Frontend und die Governance-Datenstruktur.
> Das Backend kommuniziert via REST-API mit dem Frontend.

### Ordnerstruktur (Backend-Repo)
```
quantpilot-backend/
├── backend/
│   ├── main.py                    # FastAPI App Entry
│   ├── config.py                  # Settings + Environment
│   ├── exchange/
│   │   ├── ccxt_router.py         # CCXT Multi-Exchange Adapter
│   │   ├── proxy_manager.py       # SOCKS5 Proxy-Support
│   │   └── rate_limiter.py        # Rate-Limit Backoff
│   ├── ascan/
│   │   ├── engine.py              # ASCAN Signal Engine
│   │   ├── gates.py               # 4 Pflichtgatter
│   │   └── scorer.py              # Setup-Scoring
│   ├── ulf/
│   │   ├── governance.py          # Governance Workflow + approve
│   │   ├── safety_layer.py        # Safety-Layer & Fail-Safe
│   │   └── audit.py               # Audit-Logik
│   ├── arb/
│   │   ├── scanner.py             # ARB-Scan Engine
│   │   ├── regime.py              # Regime-Erkennung
│   │   └── cost_analyzer.py       # Kostenanalyse
│   ├── runner/
│   │   ├── protection.py          # Runner-Protection Engine
│   │   ├── trailing_stop.py       # Trailing-Stop-Management
│   │   └── break_even.py          # Break-Even-Logic
│   ├── reverse_short/
│   │   ├── reversal_engine.py     # Reversal-Logik
│   │   ├── playbook.py            # Playbook-Registry
│   │   └── exit_strategy.py       # Exit-Strategien
│   ├── risk/
│   │   └── engine.py              # Risk Engine
│   ├── portfolio/
│   │   └── engine.py              # Portfolio/Exposure Engine
│   ├── notifications/
│   │   └── telegram.py            # Telegram-Alerting
│   └── db/
│       ├── postgres.py            # PostgreSQL (Metadata, Audit, Settings)
│       ├── influxdb.py            # InfluxDB (Tick/Candle Time-Series)
│       └── redis.py               # Redis (Live Events Pub/Sub)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/workflows/ci.yml       # GitHub Actions CI
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── requirements.txt
```

### Datenbank-Schema (PostgreSQL)
```sql
-- Governance Actions
CREATE TABLE governance_actions (
    id UUID PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    reason TEXT NOT NULL,
    details TEXT,
    requested_by VARCHAR(100),
    approved_by VARCHAR(100),
    request_date TIMESTAMPTZ,
    decision_date TIMESTAMPTZ,
    action_hash VARCHAR(128) UNIQUE  -- Für /governance/approve
);

-- ARB Opportunities
CREATE TABLE arb_opportunities (
    id UUID PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    buy_exchange VARCHAR(20),
    sell_exchange VARCHAR(20),
    raw_spread_percent DECIMAL(10,4),
    net_profit_percent DECIMAL(10,4),
    market_regime VARCHAR(20),
    is_profitable_after_costs BOOLEAN,
    telegram_alert_sent BOOLEAN,
    governance_approved BOOLEAN,
    status VARCHAR(30) DEFAULT 'DETECTED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Runner Positions
CREATE TABLE runner_positions (
    id UUID PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    entry_price DECIMAL(20,8),
    current_trailing_stop DECIMAL(20,8),
    break_even_activated BOOLEAN,
    tp1_filled BOOLEAN, tp2_filled BOOLEAN, tp3_filled BOOLEAN,
    remaining_size_percent DECIMAL(5,2),
    stop_adjustment_mode VARCHAR(20),
    is_adopted BOOLEAN,
    adoption_governance_approved BOOLEAN,
    status VARCHAR(30),
    opened_at TIMESTAMPTZ
);

-- Reverse-Short Signals
CREATE TABLE reverse_short_signals (
    id UUID PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    ascan_score INTEGER,
    reversal_type VARCHAR(50),
    liquidity_sweep_detected BOOLEAN,
    sweep_direction VARCHAR(20),
    decision VARCHAR(30),
    runner_exit_strategy VARCHAR(30),
    governance_approved BOOLEAN,
    status VARCHAR(30) DEFAULT 'DETECTED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs (immutable)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    category VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    entity_ref VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100)
);
```

### Time-Series-Modell (InfluxDB)
```
bucket: candles
measurement: ohlcv
tags: symbol, exchange, timeframe
fields: open, high, low, close, volume

bucket: ticks
measurement: ticker
tags: symbol, exchange
fields: bid, ask, last, spread, funding_rate
```

### GitHub Actions CI
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres: ...
      redis: ...
      influxdb: ...
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: pytest tests/unit/ -v
      - run: pytest tests/integration/ -v
  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - run: docker-compose up -d
      - run: npx playwright test
```

---

## Nächste Umsetzungsschritte

1. **Backend-Repo aufsetzen** – FastAPI + CCXT + SOCKS5-Proxy
2. **PostgreSQL/InfluxDB/Redis** via Docker Compose starten
3. **CCXT Exchange-Router** implementieren (Binance, MEXC, Bybit, OKX)
4. **ARB-Scan-Engine** mit Live-Orderbook-Polling verbinden
5. **Runner-Protection** mit echten Exchange-WebSockets koppeln
6. **Telegram-Bot** für Alerts einrichten (Bot-Token + Chat-ID)
7. **GitHub Actions CI** Pipeline konfigurieren
8. **Integration-Tests** für Governance-Workflow schreiben
9. **Frontend** von Mock-Daten auf echte Backend-API umstellen
10. **Paper-Modus** vollständig validieren vor Shadow/Live-Migration

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
| ARB-Scan | `/arb-scan` | Multi-Exchange Arbitrage-Scanner & Regime-Erkennung |
| Runner-Protection | `/runner` | Trailing-Stops, Break-Even, Teilgewinn-Logik & Audit |
| Reverse-Short | `/reverse-short` | Short-Strategien, Reversal-Logik & Playbook |
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

# SOCKS5 Proxy (Binance USDM aus EU)
SOCKS5_PROXY_HOST=127.0.0.1
SOCKS5_PROXY_PORT=1080
SOCKS5_PROXY_USERNAME=
SOCKS5_PROXY_PASSWORD=

# Additional Exchanges (ARB-Scan)
BYBIT_API_KEY=your_bybit_key
BYBIT_API_SECRET=your_bybit_secret
OKX_API_KEY=your_okx_key
OKX_API_SECRET=your_okx_secret

# CCXT Settings
CCXT_RATE_LIMIT_MS=200
CCXT_RECV_WINDOW_MS=5000
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