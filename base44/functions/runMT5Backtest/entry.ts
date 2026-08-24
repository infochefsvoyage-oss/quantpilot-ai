// QuantPilot — Real MT5 Backtest Runner (GO-5)
// Fetches historical candles from MT5 bridge, runs ICT backtest, calculates statistics.
// NO OPTIMIZATION. NO PARAMETER CHANGES. FROZEN A+ hypothesis.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchCandleHistory, fetchJson } from '../../shared/mt5Bridge.ts';
import { fetchSymbolSpec } from '../../shared/symbolSpecs.ts';
import { runBacktest, calcStats, cohensD, tTestP, bootstrap, monteCarlo, walkForward } from '../../shared/phase4Engine.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const symbol = body.symbol || "XAUUSD";
    const timeframe = body.timeframe || "M1";
    const candleCount = body.candle_count || 10000;
    const filterSession = body.filter_session || "NEW_YORK";
    const filterSide = body.filter_side || "LONG";

    const secrets = base44.getSecrets ? base44.getSecrets() : new Map();
    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");

    if (!bridgeUrl) {
      return Response.json({ status: "BLOCKED", reason: "NO_BRIDGE_URL", order_send: "BLOCKED" });
    }

    const headers = apiKey ? { "X-API-Key": apiKey } : {};
    const base = bridgeUrl.replace(/\/+$/, "");

    // 1. Fetch symbol spec + historical candles in parallel
    let candles: any[] = [];
    let symbolSpec: any = null;
    try {
      const [candleResult, spec] = await Promise.all([
        fetchCandleHistory(base, headers, symbol, timeframe, candleCount, 500),
        fetchSymbolSpec(base, headers, symbol),
      ]);
      candles = candleResult.candles || [];
      symbolSpec = spec;
    } catch {
      return Response.json({ status: "ERROR", reason: "CANDLE_FETCH_FAILED", order_send: "BLOCKED" });
    }

    if (candles.length < 1000) {
      return Response.json({
        status: "INSUFFICIENT_DATA",
        candle_count: candles.length,
        order_send: "BLOCKED",
        live_execution: "BLOCKED",
      });
    }

    // 2. Run ICT backtest (FROZEN hypothesis — no optimization)
    const setups = runBacktest(candles, filterSession, filterSide);
    const stats = calcStats(setups);
    const d = cohensD(setups);
    const pValue = tTestP(setups);
    const boot = bootstrap(setups, 10000);
    const mc = monteCarlo(setups, 10000, 5);
    const wf = walkForward(setups, candles.length, Math.min(10, Math.max(5, Math.floor(setups.length / 3) || 5)));

    // 3. Additional metrics (Sharpe, Sortino, avg winner/loser, slippage sensitivity)
    const rVals = setups.map(s => s.rMult);
    const winners = rVals.filter(r => r > 0);
    const losers = rVals.filter(r => r < 0);
    const avgWinner = winners.length > 0 ? Math.round((winners.reduce((a, b) => a + b, 0) / winners.length) * 100) / 100 : 0;
    const avgLoser = losers.length > 0 ? Math.round((losers.reduce((a, b) => a + b, 0) / losers.length) * 100) / 100 : 0;
    const downside = rVals.filter(r => r < 0);
    const downsideSd = downside.length > 0
      ? Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / downside.length) : 0;
    const sharpe = stats.stdDev > 0 ? Math.round((stats.meanR / stats.stdDev) * 100) / 100 : 0;
    const sortino = downsideSd > 0 ? Math.round((stats.meanR / downsideSd) * 100) / 100 : 0;

    // 4. Slippage sensitivity: reduce each R by 0.05R and check if edge survives
    const slippageAdjustedR = setups.map(s => s.rMult - 0.05);
    const slippageAdjTotalR = Math.round(slippageAdjustedR.reduce((a, b) => a + b, 0) * 100) / 100;
    const slippageEdgeSurvives = slippageAdjTotalR > 0;

    // 5. Gate check (GO-5 minimum criteria)
    const expectancyPass = stats.avgR >= 0.30;
    const pfPass = stats.pf >= 1.30;
    const oosPass = stats.totalR > 0;
    const rrPass = setups.length > 0 ? setups.every(s => s.rr >= 1.8 && s.rr <= 4.0) : false;
    const gatePass = expectancyPass && pfPass && oosPass;

    // 6. Create AuditLog
    await base44.entities.AuditLog.create({
      event: "MT5_BACKTEST_RUN",
      category: "TRADING",
      severity: gatePass ? "INFO" : "WARNING",
      actor: "runMT5Backtest",
      details: `Backtest ${symbol} ${timeframe}: ${stats.n} trades, WR ${stats.winrate}%, PF ${stats.pf}, Exp ${stats.avgR}R, DD ${stats.maxDD}R, Sharpe ${sharpe}, Sortino ${sortino}`,
      metadata: {
        symbol, timeframe, candle_count: candles.length,
        filter_session: filterSession, filter_side: filterSide,
        ...stats, cohens_d: d, p_value: pValue, sharpe, sortino,
        avg_winner: avgWinner, avg_loser: avgLoser,
        slippage_adjusted_total_r: slippageAdjTotalR,
        slippage_edge_survives: slippageEdgeSurvives,
        bootstrap: boot, monte_carlo: mc, walk_forward: wf,
        gate_pass: gatePass, expectancy_pass: expectancyPass, pf_pass: pfPass, oos_pass: oosPass, rr_pass: rrPass,
        order_send: "BLOCKED", live_execution: "BLOCKED",
      },
    });

    return Response.json({
      status: "SUCCESS",
      symbol, timeframe, candle_count: candles.length,
      trade_count: stats.n,
      stats: { ...stats, cohens_d: d, p_value: pValue, sharpe, sortino, avg_winner: avgWinner, avg_loser: avgLoser, slippage_adjusted_total_r: slippageAdjTotalR, slippage_edge_survives: slippageEdgeSurvives },
      bootstrap: boot, monte_carlo: mc, walk_forward: wf,
      gate: { pass: gatePass, expectancy_pass: expectancyPass, pf_pass: pfPass, oos_pass: oosPass, rr_pass: rrPass },
      order_send: "BLOCKED",
      live_execution: "BLOCKED",
    });
  } catch (error) {
    return Response.json({ error: error.message, status: "ERROR", order_send: "BLOCKED" }, { status: 500 });
  }
}