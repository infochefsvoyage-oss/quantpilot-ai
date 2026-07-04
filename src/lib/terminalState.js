// Zentrale Terminalemulation für QuantPilot AI
// Mock-Daten, die später durch echte FastAPI-Backend-Aufrufe ersetzt werden.

export const RUNTIME_STATUS = {
  mode: 'PAPER',
  runtime: 'RUNNING',
  exchange: 'binance',
  phase: 'PHASE_1',
  emergency_stop: false,
  circuit_breaker: 'OK',
  data_freshness: 'FRESH',
  uptime_seconds: 7382,
  version: 'OP-777 v1.0.0',
};

export const DASHBOARD_KPI = {
  risk_per_trade: 0.5,
  open_positions: 1,
  daily_pnl: 1.84,
  daily_pnl_pct: 1.84,
  max_drawdown: 2.31,
  daily_target: 2.0,
  consecutive_losses: 1,
  portfolio_exposure: 7.4,
};

export const RECENT_SIGNALS = [
  {
    id: 'sig-001',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    side: 'LONG',
    ascan_score: 88,
    rr: 3.2,
    spread: 0.012,
    funding: -0.0042,
    entry_price: 61250,
    stop_loss: 60850,
    take_profit: 62200,
    decision: 'ENTER',
    gates: { liquidity_sweep: true, reclaim_rejection: true, volume_confirmation: true, htf_alignment: true },
    timeframe: '15m',
    timestamp: '2026-07-04T09:32:00Z',
  },
  {
    id: 'sig-002',
    symbol: 'ETHUSDT',
    exchange: 'binance',
    side: 'SHORT',
    ascan_score: 71,
    rr: 2.1,
    spread: 0.018,
    funding: 0.0089,
    entry_price: 3120,
    stop_loss: 3165,
    take_profit: 3020,
    decision: 'WATCH_ONLY',
    gates: { liquidity_sweep: true, reclaim_rejection: true, volume_confirmation: false, htf_alignment: true },
    timeframe: '15m',
    timestamp: '2026-07-04T09:18:00Z',
  },
  {
    id: 'sig-003',
    symbol: 'SOLUSDT',
    exchange: 'mexc',
    side: 'LONG',
    ascan_score: 82,
    rr: 2.8,
    spread: 0.022,
    funding: -0.0031,
    entry_price: 148.2,
    stop_loss: 145.9,
    take_profit: 154.6,
    decision: 'ENTER_REDUCED',
    gates: { liquidity_sweep: true, reclaim_rejection: true, volume_confirmation: true, htf_alignment: true },
    timeframe: '5m',
    timestamp: '2026-07-04T08:55:00Z',
  },
  {
    id: 'sig-004',
    symbol: 'DOGEUSDT',
    exchange: 'binance',
    side: 'LONG',
    ascan_score: 44,
    rr: 1.4,
    spread: 0.05,
    funding: 0.012,
    entry_price: 0.124,
    stop_loss: 0.121,
    take_profit: 0.129,
    decision: 'NO_TRADE',
    gates: { liquidity_sweep: false, reclaim_rejection: false, volume_confirmation: false, htf_alignment: false },
    timeframe: '15m',
    timestamp: '2026-07-04T08:30:00Z',
  },
];

export const OPEN_POSITIONS = [
  {
    id: 'pos-001',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    side: 'LONG',
    mode: 'PAPER',
    entry_price: 61250,
    current_price: 61480,
    stop_loss: 60850,
    take_profit: 62200,
    size: 0.05,
    position_value: 3074,
    risk_amount: 20,
    leverage: 1,
    unrealized_pnl: 11.5,
    rr: 3.2,
    tp1_executed: false,
    tp2_executed: false,
    tp3_executed: false,
    opened_at: '2026-07-04T09:32:00Z',
  },
];

export const ULF_WARNINGS = [
  { id: 'ulf-001', level: 'WARNING', message: 'Spread auf DOGEUSDT über Limit (0.05% > 0.03%)', ts: '09:41' },
  { id: 'ulf-002', level: 'INFO', message: 'Funding-Rate auf ETHUSDT steigend – Watch Only', ts: '09:18' },
  { id: 'ulf-003', level: 'CRITICAL', message: 'Datenlatenz MEXC > 800ms – Circuit Breaker warm', ts: '09:05' },
];

export const PENDING_GOVERNANCE = [
  { id: 'gov-001', action_type: 'PAPER_TO_LIVE', reason: 'Migration Binance Paper → Live nach 30 Tagen profitabler Paper-Phase', prepared_at: '2026-07-04T08:00:00Z', requested_by: 'operator' },
];

export const AUDIT_LOGS = [
  { id: 'aud-001', event: 'PAPER_ORDER_CREATED', category: 'TRADING', severity: 'INFO', actor: 'operator', details: 'BTCUSDT LONG 0.05 @ 61250', timestamp: '2026-07-04T09:32:01Z' },
  { id: 'aud-002', event: 'ASCAN_SIGNAL_DETECTED', category: 'TRADING', severity: 'INFO', actor: 'ascan_engine', details: 'ETHUSDT Score 71 – WATCH_ONLY', timestamp: '2026-07-04T09:18:22Z' },
  { id: 'aud-003', event: 'GOVERNANCE_PREPARED', category: 'GOVERNANCE', severity: 'WARNING', actor: 'operator', details: 'PAPER_TO_LIVE vorbereitet', timestamp: '2026-07-04T08:00:05Z' },
  { id: 'aud-004', event: 'CIRCUIT_BREAKER_WARN', category: 'SYSTEM', severity: 'WARNING', actor: 'risk_engine', details: 'MEXC Datenlatenz 812ms', timestamp: '2026-07-04T09:05:14Z' },
];

export const JOURNAL_TODAY = {
  date: '2026-07-04',
  trades_count: 4,
  wins: 3,
  losses: 1,
  win_rate: 75,
  realized_pnl: 1.84,
  max_drawdown: 0.9,
  gate_success_rate: 62,
  mm_compliance: 100,
  ulf_warnings: 3,
  daily_target_hit: false,
  notes: '',
};

export const DECISION_META = {
  ENTER: { label: 'ENTER', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  ENTER_REDUCED: { label: 'ENTER (reduziert)', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30', dot: 'bg-cyan-400' },
  WATCH_ONLY: { label: 'WATCH ONLY', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' },
  NO_TRADE: { label: 'NO TRADE', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400' },
};

export const SEVERITY_META = {
  INFO: 'text-slate-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-orange-400',
  CRITICAL: 'text-red-400',
};