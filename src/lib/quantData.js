// QuantPilot AI – Mock-Daten für Frontend-Prototyp
// In Produktion: Anbindung an FastAPI-Backend (siehe README)

export const runtimeStatus = {
  mode: "PAPER",
  exchange_phase: "PHASE_1",
  ascan_engine: "ACTIVE",
  governance_engine: "ACTIVE",
  risk_engine: "ACTIVE",
  portfolio_engine: "ACTIVE",
  exchange_router: "ACTIVE",
  audit_log: "ACTIVE",
  emergency_stop: false,
  circuit_breaker: false,
  uptime_seconds: 128440,
  data_lag_ms: 142,
  last_health_check: "2026-07-04T14:32:00Z",
};

export const riskDefaults = {
  risk_level: "LEVEL_2",
  risk_per_trade: 0.50,
  max_open_positions: 1,
  portfolio_exposure_cap: 10,
  daily_loss_limit: 1.50,
  weekly_loss_limit: 4.00,
  max_drawdown_pause: 6.00,
  capital_priority: "CAPITAL_PRESERVATION_FIRST",
  high_leverage_mode: "DISABLED",
  daily_target: 2.0,
  consecutive_losses_halve: 2,
};

export const portfolioSummary = {
  total_equity: 25000,
  available_margin: 23750,
  open_exposure: 1250,
  exposure_percent: 5.0,
  daily_pnl: 142.50,
  daily_pnl_percent: 0.57,
  weekly_pnl: -310.20,
  weekly_pnl_percent: -1.24,
  max_drawdown: 2.34,
  consecutive_losses: 1,
  open_positions: 1,
  daily_target: 2.0,
  daily_target_hit: false,
};

export const sampleSignals = [
  {
    id: "sig_001",
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    ascan_score: 87,
    rr: 3.2,
    decision: "ENTER",
    gate_liquidity_sweep: true,
    gate_reclaim_rejection: true,
    gate_volume_confirmation: true,
    gate_htf_alignment: true,
    spread_ok: true,
    funding_ok: true,
    data_fresh: true,
    stop_loss_present: true,
    entry_price: 61250.5,
    stop_loss: 60800.0,
    take_profit_1: 61850.0,
    take_profit_2: 62400.0,
    take_profit_3: 63200.0,
    htf_bias: "LONG",
    notes: "Liquidity Sweep unter H4 EMA, Reclaim mit Volume Spike",
    created_date: "2026-07-04T14:28:00Z",
  },
  {
    id: "sig_002",
    symbol: "ETHUSDT",
    exchange: "BINANCE",
    ascan_score: 79,
    rr: 2.8,
    decision: "ENTER_REDUCED",
    gate_liquidity_sweep: true,
    gate_reclaim_rejection: true,
    gate_volume_confirmation: true,
    gate_htf_alignment: false,
    spread_ok: true,
    funding_ok: true,
    data_fresh: true,
    stop_loss_present: true,
    entry_price: 3142.8,
    stop_loss: 3110.0,
    take_profit_1: 3180.0,
    take_profit_2: 3210.0,
    take_profit_3: 3260.0,
    htf_bias: "LONG",
    notes: "HTF nur partiell aligned – reduzierte Position",
    created_date: "2026-07-04T14:15:00Z",
  },
  {
    id: "sig_003",
    symbol: "SOLUSDT",
    exchange: "MEXC",
    ascan_score: 61,
    rr: 2.1,
    decision: "WATCH_ONLY",
    gate_liquidity_sweep: true,
    gate_reclaim_rejection: false,
    gate_volume_confirmation: true,
    gate_htf_alignment: true,
    spread_ok: true,
    funding_ok: true,
    data_fresh: true,
    stop_loss_present: true,
    entry_price: 148.2,
    stop_loss: 145.0,
    take_profit_1: 152.0,
    take_profit_2: 156.0,
    take_profit_3: 162.0,
    htf_bias: "NEUTRAL",
    notes: "Reclaim fehlt – WATCH_ONLY bis Bestätigung",
    created_date: "2026-07-04T13:50:00Z",
  },
  {
    id: "sig_004",
    symbol: "DOGEUSDT",
    exchange: "BINANCE",
    ascan_score: 44,
    rr: 1.4,
    decision: "NO_TRADE",
    gate_liquidity_sweep: false,
    gate_reclaim_rejection: false,
    gate_volume_confirmation: false,
    gate_htf_alignment: false,
    spread_ok: false,
    funding_ok: true,
    data_fresh: true,
    stop_loss_present: false,
    entry_price: 0.1245,
    stop_loss: 0,
    take_profit_1: 0,
    take_profit_2: 0,
    take_profit_3: 0,
    htf_bias: "NEUTRAL",
    notes: "Kein A+ Setup – Score zu niedrig, RR unter Limit",
    created_date: "2026-07-04T13:20:00Z",
  },
];

export const openTrades = [
  {
    id: "trd_001",
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    mode: "PAPER",
    side: "LONG",
    entry_price: 61250.5,
    exit_price: 0,
    stop_loss: 60800.0,
    position_size: 0.02,
    risk_percent: 0.50,
    rr: 3.2,
    ascan_score: 87,
    status: "TP1_HIT",
    pnl: 45.0,
    pnl_percent: 0.18,
    tp1_filled: true,
    tp2_filled: false,
    tp3_filled: false,
    opened_at: "2026-07-04T14:28:00Z",
  },
];

export const closedTradesToday = [
  { id: "trd_002", symbol: "ETHUSDT", mode: "PAPER", side: "SHORT", pnl: 52.3, pnl_percent: 0.21, status: "CLOSED", closed_at: "2026-07-04T12:10:00Z", ascan_score: 82 },
  { id: "trd_003", symbol: "SOLUSDT", mode: "PAPER", side: "LONG", pnl: -18.7, pnl_percent: -0.07, status: "STOPPED_OUT", closed_at: "2026-07-04T11:30:00Z", ascan_score: 71 },
  { id: "trd_004", symbol: "AVAXUSDT", mode: "PAPER", side: "LONG", pnl: 63.9, pnl_percent: 0.25, status: "CLOSED", closed_at: "2026-07-04T10:05:00Z", ascan_score: 78 },
];

export const pendingGovernance = [
  {
    id: "gov_001",
    action_type: "PAPER_TO_LIVE",
    status: "PENDING",
    reason: "Migration von Paper zu Live-Trading auf Binance nach 30 Tagen profitablen Paper-Trades",
    details: "Exchange: BINANCE | Symbol: BTCUSDT | Max Risk: 0.5% | Leverage: 3x",
    request_date: "2026-07-04T09:00:00Z",
  },
  {
    id: "gov_002",
    action_type: "RISK_INCREASE",
    status: "PENDING",
    reason: "Erhöhung risk_per_trade von 0.5% auf 0.75%",
    details: "Aktuelles Level: LEVEL_2 | Ziel: LEVEL_3 | Begründung: 14 Tage konsistent positiv",
    request_date: "2026-07-04T08:15:00Z",
  },
];

export const ulfWarnings = [
  { id: "ulf_001", severity: "WARNING", module: "Risk Engine", message: "1 aufeinanderfolgender Verlust – bei 2 wird Risiko halbiert", is_active: true },
  { id: "ulf_002", severity: "INFO", module: "Exchange Router", message: "Binance API Rate Limit bei 68% – Backoff aktiv", is_active: true },
  { id: "ulf_003", severity: "CRITICAL", module: "Governance", message: "2 Pending Actions warten auf Freigabe", is_active: true },
];

export const auditLogs = [
  { id: "aud_001", category: "TRADE", action: "PAPER_ORDER_CREATED", severity: "INFO", message: "Paper Order BTCUSDT LONG erstellt | Entry 61250.5 | SL 60800", entity_ref: "trd_001", created_date: "2026-07-04T14:28:00Z" },
  { id: "aud_002", category: "TRADE", action: "TP1_FILLED", severity: "INFO", message: "BTCUSDT TP1 ausgeführt – 40% geschlossen, Stop auf Break-even", entity_ref: "trd_001", created_date: "2026-07-04T15:02:00Z" },
  { id: "aud_003", category: "GOVERNANCE", action: "ACTION_PREPARED", severity: "WARNING", message: "Governance Action PAPER_TO_LIVE vorbereitet – wartet auf Freigabe", entity_ref: "gov_001", created_date: "2026-07-04T09:00:00Z" },
  { id: "aud_004", category: "RISK", action: "LOSS_LIMIT_WARNING", severity: "WARNING", message: "Tagesverlust bei 0.37% – Limit bei 1.5%", created_date: "2026-07-04T11:30:00Z" },
  { id: "aud_005", category: "EXCHANGE", action: "RATE_LIMIT_BACKOFF", severity: "INFO", message: "Binance API: 200ms Backoff aktiviert", created_date: "2026-07-04T13:45:00Z" },
  { id: "aud_006", category: "SAFETY", action: "EMERGENCY_STOP_TEST", severity: "CRITICAL", message: "Emergency Stop manuell getestet – alle neuen Trades blockiert", created_date: "2026-07-04T08:00:00Z" },
];

export const journalEntries = [
  { id: "jnl_001", date: "2026-07-03", trades_count: 5, wins: 3, losses: 2, win_rate: 60, daily_pnl: 187.4, daily_pnl_percent: 0.75, max_drawdown: 1.1, gate_success_rate: 80, mm_compliance: true, ulf_warnings: 2, notes: "Disziplinierter Tag, 2 Early Exits vermieden", daily_target_hit: false },
  { id: "jnl_002", date: "2026-07-02", trades_count: 4, wins: 4, losses: 0, win_rate: 100, daily_pnl: 412.8, daily_pnl_percent: 1.65, max_drawdown: 0.4, gate_success_rate: 100, mm_compliance: true, ulf_warnings: 0, notes: "Perfekter Tag – Tagesziel erreicht, Trading früh beendet", daily_target_hit: true },
  { id: "jnl_003", date: "2026-07-01", trades_count: 6, wins: 2, losses: 4, win_rate: 33, daily_pnl: -285.6, daily_pnl_percent: -1.14, max_drawdown: 1.8, gate_success_rate: 50, mm_compliance: false, ulf_warnings: 4, notes: "Overtrading erkannt – 2 Trades ohne HTF Alignment erzwungen", daily_target_hit: false },
];

export const backtestResult = {
  symbol: "BTCUSDT",
  timeframe: "15m",
  period: "2026-01-01 bis 2026-06-30",
  total_trades: 142,
  wins: 89,
  losses: 53,
  win_rate: 62.7,
  total_return: 18.4,
  max_drawdown: 4.2,
  sharpe_ratio: 1.84,
  profit_factor: 2.1,
  avg_rr: 2.8,
  equity_curve: [
    100, 101.2, 100.8, 102.5, 104.1, 103.2, 105.8, 107.3, 106.1, 108.9,
    110.2, 109.5, 112.1, 114.3, 113.0, 115.8, 117.2, 116.1, 118.4, 118.4,
  ],
};

export const liveFeedEvents = [
  { id: "evt_001", time: "14:32:01", exchange: "BINANCE", type: "TICK", message: "BTCUSDT 61250.5 | Vol 1.2k", severity: "INFO" },
  { id: "evt_002", time: "14:31:58", exchange: "BINANCE", type: "SIGNAL", message: "ASCAN Scan abgeschlossen – 1 A+ Setup gefunden", severity: "INFO" },
  { id: "evt_003", time: "14:31:45", exchange: "MEXC", type: "SCAN", message: "MEXC Scan-Modul: 12 Symbole gescannt, 0 A+", severity: "INFO" },
  { id: "evt_004", time: "14:31:30", exchange: "BINANCE", type: "ORDER", message: "Paper Order BTCUSDT TP1 gefüllt", severity: "INFO" },
  { id: "evt_005", time: "14:31:12", exchange: "BINANCE", type: "WARNING", message: "Rate Limit 68% – Backoff aktiv", severity: "WARNING" },
  { id: "evt_006", time: "14:30:55", exchange: "SYSTEM", type: "RISK", message: "Risk Engine Check: Exposure 5% (Cap 10%)", severity: "INFO" },
  { id: "evt_007", time: "14:30:30", exchange: "SYSTEM", type: "GOVERNANCE", message: "2 Pending Actions aktiv", severity: "WARNING" },
];

export const exchangeConnections = [
  { id: "exc_001", exchange: "BINANCE", phase: "TESTNET_PAPER", scan_enabled: true, paper_enabled: true, shadow_enabled: false, live_enabled: false, api_key_id: "binance_testnet_***", last_sync: "2026-07-04T14:30:00Z", rate_limit_status: "OK", circuit_breaker_active: false },
  { id: "exc_002", exchange: "MEXC", phase: "DISABLED", scan_enabled: true, paper_enabled: false, shadow_enabled: false, live_enabled: false, api_key_id: "", last_sync: null, rate_limit_status: "OK", circuit_breaker_active: false },
];

export const decisionConfig = {
  ENTER: { label: "ENTER", color: "profit", desc: "Alle 4 Gates erfüllt – Trade erlaubt" },
  ENTER_REDUCED: { label: "ENTER_REDUCED", color: "cyan", desc: "A+ mit Einschränkung – reduzierte Position" },
  WATCH_ONLY: { label: "WATCH_ONLY", color: "warning", desc: "Gates nicht vollständig – nur beobachten" },
  NO_TRADE: { label: "NO_TRADE", color: "loss", desc: "Kein A+ Setup – kein Trade" },
};

export const governanceActionLabels = {
  LIVE_TRADE: "Live Trade",
  PAPER_TO_LIVE: "Paper → Live",
  RISK_INCREASE: "Risiko-Erhöhung",
  LEVERAGE_INCREASE: "Leverage-Erhöhung",
  EXCHANGE_KEY_ACTIVATION: "API-Key Aktivierung",
  DISABLE_STOP_LOSS: "Stop-Loss deaktivieren",
  MAX_POSITIONS_INCREASE: "Max. Positionen erhöhen",
  STRATEGY_SWITCH: "Strategie wechseln",
  EMERGENCY_OVERRIDE: "Emergency Override",
};

export function formatCurrency(n) {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPrice(n) {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 5 });
}

export function formatPnl(n) {
  if (typeof n !== "number") return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}