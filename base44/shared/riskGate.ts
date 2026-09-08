// QuantPilot — Pre-Order Risk Gate (Shared Module) — GO-4 Risk Engine 2.1
// Checks percentage-normalized daily/weekly loss and drawdown, mode-scoped
// open positions, portfolio exposure, position sizing, broker stops, spread and margin.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

export interface RiskGateResult {
  pass: boolean;
  reason: string;
  checks: {
    max_risk_per_trade: boolean;
    max_daily_loss: boolean;
    max_weekly_loss: boolean;
    max_open_positions: boolean;
    max_consecutive_losses: boolean;
    max_drawdown: boolean;
    portfolio_exposure_cap: boolean;
    position_size: boolean;
    sl_distance: boolean;
    broker_stop_level: boolean;
    spread_guard: boolean;
    margin_guard: boolean;
  };
  details: {
    risk_per_trade: number;
    max_open_positions: number;
    daily_loss_limit: number;
    weekly_loss_limit: number;
    max_drawdown_pause: number;
    portfolio_exposure_cap: number;
    consecutive_loss_halving: number;
    execution_mode: string;
    current_open_positions: number;
    daily_pnl: number;
    daily_pnl_pct: number;
    weekly_pnl: number;
    weekly_pnl_pct: number;
    consecutive_losses: number;
    current_drawdown: number;
    current_drawdown_pct: number;
    current_exposure_pct: number;
    proposed_exposure_pct: number;
    total_exposure_after_order_pct: number;
    position_size: number;
    sl_distance: number;
    account_balance: number;
    contract_size: number;
    spread: number;
    free_margin: number;
    required_margin: number;
    stops_level: number;
  };
}

function n(v: any, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function round(v: number, decimals = 6): number {
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
}

function stepDecimals(step: number): number {
  const s = String(step);
  if (s.includes('e-')) return Math.min(12, Number(s.split('e-')[1]) || 0);
  return Math.min(12, (s.split('.')[1] || '').length);
}

function tradeEventTime(t: any): number {
  return new Date(t.closed_at || t.opened_at || t.updated_date || t.created_date || 0).getTime();
}

function mondayStartUtc(now = new Date()): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.getTime();
}

export async function evaluateRiskGate(
  base44: any,
  signal?: {
    entry_price?: number; stop_loss?: number; side?: string; take_profit?: number;
    account_balance?: number; contract_size?: number; tick_value?: number; tick_size?: number;
    volume_min?: number; volume_max?: number; volume_step?: number;
    spread?: number; free_margin?: number; required_margin?: number;
    stops_level?: number; max_spread_points?: number;
    execution_mode?: 'PAPER' | 'SHADOW' | 'LIVE';
  }
): Promise<RiskGateResult> {
  const settings = await base44.entities.RiskSettings.list('-created_date', 1);
  const r = settings[0] || {
    risk_per_trade: 0.5, max_open_positions: 1, daily_loss_limit: 1.5,
    weekly_loss_limit: 4, max_drawdown_pause: 6, portfolio_exposure_cap: 10,
    consecutive_loss_halving: 2,
  };

  const balance = n(signal?.account_balance, 10000) > 0 ? n(signal?.account_balance, 10000) : 10000;
  const mode = signal?.execution_mode || 'ALL';
  const trades = await base44.entities.Trade.list('-created_date', 500);
  const scopedTrades = mode === 'ALL' ? trades : trades.filter((t: any) => t.mode === mode);
  const openTrades = scopedTrades.filter((t: any) => t.status === 'open');

  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const weekStart = mondayStartUtc(now);

  const realizedInRange = (start: number, end: number) => scopedTrades
    .filter((t: any) => {
      const ts = tradeEventTime(t);
      return ts >= start && ts < end;
    })
    .reduce((sum: number, t: any) => sum + n(t.realized_pnl), 0);

  const dailyPnl = realizedInRange(todayStart, tomorrowStart);
  const weeklyPnl = realizedInRange(weekStart, tomorrowStart);
  const dailyLossPct = dailyPnl < 0 ? Math.abs(dailyPnl) / balance * 100 : 0;
  const weeklyLossPct = weeklyPnl < 0 ? Math.abs(weeklyPnl) / balance * 100 : 0;

  const closed = scopedTrades
    .filter((t: any) => t.status === 'closed')
    .sort((a: any, b: any) => tradeEventTime(b) - tradeEventTime(a));

  let consecLosses = 0;
  for (const t of closed) {
    if (n(t.realized_pnl) < 0) consecLosses++;
    else break;
  }

  let run = 0, peak = 0, maxDD = 0;
  for (const t of [...closed].reverse()) {
    run += n(t.realized_pnl);
    if (run > peak) peak = run;
    maxDD = Math.max(maxDD, peak - run);
  }
  const maxDDPct = maxDD / balance * 100;

  // Dynamic position sizing: never round upward beyond the configured risk budget.
  let posSize = 0, slDist = 0;
  const entry = n(signal?.entry_price);
  const stop = n(signal?.stop_loss);
  const contractSize = n(signal?.contract_size, 100) > 0 ? n(signal?.contract_size, 100) : 100;
  if (entry > 0 && stop > 0) {
    slDist = Math.abs(entry - stop);
    const riskPct = n(r.risk_per_trade, 0.5) / 100;
    const riskAmount = balance * riskPct;
    if (slDist > 0 && contractSize > 0) {
      const rawSize = riskAmount / (slDist * contractSize);
      const volStep = n(signal?.volume_step, 0.01) > 0 ? n(signal?.volume_step, 0.01) : 0.01;
      const volMin = n(signal?.volume_min, 0.01);
      const volMax = n(signal?.volume_max, 100);
      const decimals = stepDecimals(volStep);
      if (rawSize >= volMin) {
        posSize = Math.floor(rawSize / volStep + 1e-9) * volStep;
        posSize = Number(posSize.toFixed(decimals));
        posSize = Math.min(volMax, posSize);
      }
    }
  }

  const currentExposureValue = openTrades.reduce((sum: number, t: any) => sum + Math.abs(n(t.position_value)), 0);
  const proposedExposureValue = entry > 0 && posSize > 0 ? Math.abs(entry * posSize * contractSize) : 0;
  const currentExposurePct = currentExposureValue / balance * 100;
  const proposedExposurePct = proposedExposureValue / balance * 100;
  const totalExposureAfterOrderPct = currentExposurePct + proposedExposurePct;

  const stopsLevel = n(signal?.stops_level);
  const tickSize = n(signal?.tick_size, 0.01) > 0 ? n(signal?.tick_size, 0.01) : 0.01;
  const minStopDist = stopsLevel * tickSize;
  const tpDistance = n(signal?.take_profit) > 0 && entry > 0 ? Math.abs(n(signal?.take_profit) - entry) : 0;
  const brokerStopLevelPass = slDist >= minStopDist && tpDistance >= minStopDist;

  const spread = n(signal?.spread);
  const maxSpread = n(signal?.max_spread_points, 50);
  const spreadGuardPass = spread <= maxSpread;

  const freeMargin = n(signal?.free_margin);
  const requiredMargin = n(signal?.required_margin);
  const marginGuardPass = requiredMargin === 0 || freeMargin >= requiredMargin * 1.1;

  const checks = {
    max_risk_per_trade: n(r.risk_per_trade, 0.5) <= 2,
    max_daily_loss: dailyLossPct < n(r.daily_loss_limit, 1.5),
    max_weekly_loss: weeklyLossPct < n(r.weekly_loss_limit, 4),
    max_open_positions: openTrades.length < n(r.max_open_positions, 1),
    max_consecutive_losses: consecLosses < n(r.consecutive_loss_halving, 2),
    max_drawdown: maxDDPct < n(r.max_drawdown_pause, 6),
    portfolio_exposure_cap: totalExposureAfterOrderPct <= n(r.portfolio_exposure_cap, 10),
    position_size: posSize > 0 && posSize <= n(signal?.volume_max, 100),
    sl_distance: slDist > 0,
    broker_stop_level: brokerStopLevelPass,
    spread_guard: spreadGuardPass,
    margin_guard: marginGuardPass,
  };

  const pass = Object.values(checks).every(Boolean);
  const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const reason = pass ? 'ALL_CHECKS_PASS' : `FAIL: ${failedChecks.join(', ')}`;

  return {
    pass,
    reason,
    checks,
    details: {
      risk_per_trade: n(r.risk_per_trade, 0.5),
      max_open_positions: n(r.max_open_positions, 1),
      daily_loss_limit: n(r.daily_loss_limit, 1.5),
      weekly_loss_limit: n(r.weekly_loss_limit, 4),
      max_drawdown_pause: n(r.max_drawdown_pause, 6),
      portfolio_exposure_cap: n(r.portfolio_exposure_cap, 10),
      consecutive_loss_halving: n(r.consecutive_loss_halving, 2),
      execution_mode: mode,
      current_open_positions: openTrades.length,
      daily_pnl: round(dailyPnl, 2),
      daily_pnl_pct: round(dailyLossPct, 4),
      weekly_pnl: round(weeklyPnl, 2),
      weekly_pnl_pct: round(weeklyLossPct, 4),
      consecutive_losses: consecLosses,
      current_drawdown: round(maxDD, 2),
      current_drawdown_pct: round(maxDDPct, 4),
      current_exposure_pct: round(currentExposurePct, 4),
      proposed_exposure_pct: round(proposedExposurePct, 4),
      total_exposure_after_order_pct: round(totalExposureAfterOrderPct, 4),
      position_size: posSize,
      sl_distance: round(slDist, 8),
      account_balance: balance,
      contract_size: contractSize,
      spread,
      free_margin: freeMargin,
      required_margin: requiredMargin,
      stops_level: stopsLevel,
    },
  };
}
