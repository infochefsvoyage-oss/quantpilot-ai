// QuantPilot — Pre-Order Risk Gate (Shared Module) — GO-4 Risk Engine 2.0
// Used by preOrderRiskGate and autoOrderPipeline backend functions.
// Checks: MAX_RISK_PER_TRADE, MAX_DAILY_LOSS, MAX_OPEN_POSITIONS,
// MAX_CONSECUTIVE_LOSSES, MAX_DRAWDOWN, POSITION_SIZE, SL_DISTANCE,
// BROKER_STOP_LEVEL, SPREAD_GUARD, MARGIN_GUARD.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

export interface RiskGateResult {
  pass: boolean;
  reason: string;
  checks: {
    max_risk_per_trade: boolean;
    max_daily_loss: boolean;
    max_open_positions: boolean;
    max_consecutive_losses: boolean;
    max_drawdown: boolean;
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
    max_drawdown_pause: number;
    consecutive_loss_halving: number;
    current_open_positions: number;
    daily_pnl: number;
    consecutive_losses: number;
    current_drawdown: number;
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

export async function evaluateRiskGate(
  base44: any,
  signal?: {
    entry_price?: number; stop_loss?: number; side?: string; take_profit?: number;
    account_balance?: number; contract_size?: number; tick_value?: number; tick_size?: number;
    volume_min?: number; volume_max?: number; volume_step?: number;
    spread?: number; free_margin?: number; required_margin?: number;
    stops_level?: number; max_spread_points?: number;
  }
): Promise<RiskGateResult> {
  const settings = await base44.entities.RiskSettings.list("-created_date", 1);
  const r = settings[0] || {
    risk_per_trade: 0.5, max_open_positions: 1, daily_loss_limit: 1.5,
    max_drawdown_pause: 6, consecutive_loss_halving: 2,
  };

  const trades = await base44.entities.Trade.list("-created_date", 200);
  const openTrades = trades.filter((t: any) => t.status === "open");
  const today = new Date().toISOString().split("T")[0];
  const todayTrades = trades.filter((t: any) => t.opened_at?.startsWith(today));
  const dailyPnl = todayTrades.reduce((s: number, t: any) => s + (t.realized_pnl || 0), 0);

  const closed = trades
    .filter((t: any) => t.status === "closed")
    .sort((a: any, b: any) =>
      new Date(b.closed_at || b.updated_date).getTime() - new Date(a.closed_at || a.updated_date).getTime()
    );

  let consecLosses = 0;
  for (const t of closed) {
    if ((t.realized_pnl || 0) < 0) consecLosses++;
    else break;
  }

  let run = 0, peak = 0, maxDD = 0;
  for (const t of [...closed].reverse()) {
    run += t.realized_pnl || 0;
    if (run > peak) peak = run;
    const dd = peak - run;
    if (dd > maxDD) maxDD = dd;
  }

  // Dynamic position sizing: risk_amount / (sl_distance * contract_size)
  let posSize = 0, slDist = 0;
  if (signal?.entry_price && signal?.stop_loss) {
    slDist = Math.abs(signal.entry_price - signal.stop_loss);
    const balance = signal.account_balance || 10000;
    const riskPct = (r.risk_per_trade || 0.5) / 100;
    const riskAmount = balance * riskPct;
    const contractSize = signal.contract_size || 100;
    if (slDist > 0 && contractSize > 0) {
      posSize = riskAmount / (slDist * contractSize);
      const volStep = signal.volume_step || 0.01;
      posSize = Math.round(posSize / volStep) * volStep;
      posSize = Math.round(posSize * 100) / 100;
      const volMin = signal.volume_min || 0.01;
      const volMax = signal.volume_max || 100;
      posSize = Math.max(volMin, Math.min(volMax, posSize));
    }
  }

  // Broker stop level: SL/TP must be at least stops_level * tick_size away
  const stopsLevel = signal?.stops_level || 0;
  const tickSize = signal?.tick_size || 0.01;
  const minStopDist = stopsLevel * tickSize;
  const tpDistance = signal?.take_profit && signal?.entry_price
    ? Math.abs(signal.take_profit - signal.entry_price) : 0;
  const brokerStopLevelPass = slDist >= minStopDist && tpDistance >= minStopDist;

  // Spread guard
  const spread = signal?.spread || 0;
  const maxSpread = signal?.max_spread_points || 50;
  const spreadGuardPass = spread <= maxSpread;

  // Margin guard: free_margin must cover required_margin with 10% buffer
  const freeMargin = signal?.free_margin || 0;
  const requiredMargin = signal?.required_margin || 0;
  const marginGuardPass = requiredMargin === 0 || freeMargin >= requiredMargin * 1.1;

  const checks = {
    max_risk_per_trade: (r.risk_per_trade || 0.5) <= 2,
    max_daily_loss: dailyPnl >= -(r.daily_loss_limit || 1.5),
    max_open_positions: openTrades.length < (r.max_open_positions || 1),
    max_consecutive_losses: consecLosses < (r.consecutive_loss_halving || 2),
    max_drawdown: maxDD < (r.max_drawdown_pause || 6),
    position_size: posSize > 0 && posSize <= 100,
    sl_distance: slDist > 0,
    broker_stop_level: brokerStopLevelPass,
    spread_guard: spreadGuardPass,
    margin_guard: marginGuardPass,
  };

  const pass = Object.values(checks).every((c) => c === true);
  const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const reason = pass ? "ALL_CHECKS_PASS" : `FAIL: ${failedChecks.join(", ")}`;

  return {
    pass,
    reason,
    checks,
    details: {
      risk_per_trade: r.risk_per_trade || 0.5,
      max_open_positions: r.max_open_positions || 1,
      daily_loss_limit: r.daily_loss_limit || 1.5,
      max_drawdown_pause: r.max_drawdown_pause || 6,
      consecutive_loss_halving: r.consecutive_loss_halving || 2,
      current_open_positions: openTrades.length,
      daily_pnl: Math.round(dailyPnl * 100) / 100,
      consecutive_losses: consecLosses,
      current_drawdown: Math.round(maxDD * 100) / 100,
      position_size: posSize,
      sl_distance: Math.round(slDist * 100) / 100,
      account_balance: signal?.account_balance || 10000,
      contract_size: signal?.contract_size || 100,
      spread,
      free_margin: freeMargin,
      required_margin: requiredMargin,
      stops_level: stopsLevel,
    },
  };
}