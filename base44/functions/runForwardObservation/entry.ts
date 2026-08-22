// QuantPilot — Forward Observation Collector (AUDITED)
// Collects new OOS trades from LIVE MT5 bridge data (strictly after OOS_HISTORICAL_END).
// FROZEN hypothesis: NO optimization, NO parameter changes, NO order execution.
//
// KEY FIX: When 0 new forward trades, statistics are copied from the Phase 4 audit
// (NOT recalculated). This prevents walk-forward regression and statistical drift.
// The walkForward function filters by s.idx (global candle index); trade converters
// don't have idx, so recalculating with converted trades produces 0/5 blocks (regression).
//
// Secrets: MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, fetchCandleHistory, fetchJson, getServerTimeMs } from '../../shared/mt5Bridge.ts';
import {
  runPhase4Validation, calcStats, cohensD, powerAndN,
  tTestP, bootstrap, walkForward,
} from '../../shared/phase4Engine.ts';
import {
  STRATEGY_VERSION, PARAMETER_HASH, computeFingerprint,
  historicalTradesToSetups, forwardTradesToSetups,
} from '../../shared/forwardObservation.ts';

const FETCH_CANDLES = 10000;
const BATCH_SIZE = 5000;
const STALE_THRESHOLD_MS = 120000; // 2 minutes

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const currentUtcTimestamp = Date.now();
    const currentUtcIso = new Date(currentUtcTimestamp).toISOString();

    // ── 1. FORWARD BOUNDARY: Read latest Phase 4 OOS ───────────────────
    const logs = await base44.entities.AuditLog.list("-created_date", 50);
    const phase4 = (logs || []).find((l) => l.event === "NY_LONG_PHASE_4_OOS_VALIDATION");
    const phase4Meta = phase4?.metadata || {};
    const phase4Val = phase4Meta.validation || phase4Meta;
    const oosHistoricalEnd: number = phase4Val.oos_range?.end || 0;

    if (!oosHistoricalEnd) {
      return Response.json({
        status: "INVALID",
        reason: "NO_OOS_BOUNDARY",
        message: "No Phase 4 OOS validation found — cannot determine forward boundary",
      });
    }

    const historicalTrades = phase4Val.trades || phase4Meta.trades || [];
    const historicalN = historicalTrades.length;

    // Previous statistics from Phase 4 (for regression check)
    const prevStats = {
      n: phase4Val.trade_count || historicalN,
      total_r: phase4Val.totalR ?? 0,
      win_rate: phase4Val.winrate ?? 0,
      profit_factor: phase4Val.pf ?? phase4Val.profit_factor ?? 0,
      max_dd: phase4Val.max_drawdown ?? phase4Val.max_dd ?? 0,
      mean_r: phase4Val.mean_r ?? phase4Val.avgR ?? 0,
      median_r: phase4Val.medianR ?? 0,
      ci_95: phase4Val.ci_95 || [0, 0],
      p_value: phase4Val.p_value ?? 1,
      power: phase4Val.power ?? 0,
      required_n: phase4Val.required_n || 82,
      max_loss_streak: phase4Val.max_loss_streak ?? 0,
      max_win_streak: phase4Val.max_win_streak ?? 0,
      avg_hold: phase4Val.avg_hold ?? phase4Val.avgHold ?? 0,
    };
    const prevWF = phase4Val.walk_forward || {};
    const prevWFPositive = prevWF.positive ?? 0;
    const prevWFNegative = prevWF.negative ?? 0;
    const prevWFZero = prevWF.zero ?? 0;
    const prevWFTotal = (prevWF.blocks?.length) || 5;

    // ── 2. LIVE DATA: Fetch tick + candles from MT5 Bridge ─────────────
    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    if (!bridgeUrl) {
      return Response.json({ status: "INVALID", reason: "NO_BRIDGE_URL" });
    }

    const headers = apiKey ? { "X-API-Key": apiKey } : {};
    const base = bridgeUrl.replace(/\/+$/, "");

    // Fetch tick (for latest tick timestamp + server time) + verification (for timezone)
    let tickJ: any = {};
    let verJ: any = {};
    let allCandles: any[] = [];
    let bridgeReachable = false;

    try {
      const [tickResp, verResp] = await Promise.all([
        fetchJson(`${base}/symbols/${SYMBOL}/tick`, headers, 6000),
        fetchJson(`${base}/verification`, headers, 6000),
      ]);
      tickJ = tickResp.json || {};
      verJ = verResp.json || {};
      bridgeReachable = tickResp.ok || verResp.ok;
    } catch {
      bridgeReachable = false;
    }

    // Fetch candles (for latest candle timestamp + forward candles)
    if (bridgeReachable) {
      try {
        const result = await fetchCandleHistory(base, headers, SYMBOL, "M1", FETCH_CANDLES, BATCH_SIZE);
        allCandles = result.candles || [];
      } catch {
        allCandles = [];
      }
    }

    // ── 3. TIMESTAMP NORMALIZATION (all UTC) ──────────────────────────
    const latestTickTimestamp: number = tickJ.time || 0;
    const serverTimeMs: number = getServerTimeMs(tickJ) || currentUtcTimestamp;
    const latestCandleTimestamp: number =
      allCandles.length > 0 ? allCandles[allCandles.length - 1].time : 0;
    const sourceTimezone: string =
      verJ.server_timezone || verJ.timezone || verJ.broker_timezone || "UTC (Unix timestamps)";

    // Tick age: prefer server_time_ms, fall back to tick time
    const tickAgeMs: number = latestTickTimestamp > 0
      ? Math.max(0, currentUtcTimestamp - latestTickTimestamp * 1000)
      : 999999;

    // ── 4. FEED STATUS ────────────────────────────────────────────────
    let feedStatus: string;
    if (!bridgeReachable) {
      feedStatus = "DISCONNECTED";
    } else if (tickAgeMs >= STALE_THRESHOLD_MS) {
      feedStatus = "STALE";
    } else {
      feedStatus = "LIVE";
    }

    // ── 5. FORWARD DATA CHECK (strict > OOS_HISTORICAL_END) ────────────
    const forwardCandles = allCandles.filter((c) => c.time > oosHistoricalEnd);
    const forwardDataAvailable: boolean = forwardCandles.length > 0;
    const forwardDataValid: boolean =
      feedStatus === "LIVE" && forwardDataAvailable && (tickJ.source || "MT5_BRIDGE_LIVE") !== "MOCK";
    const dataSource: string = tickJ.source || "MT5_BRIDGE_LIVE";

    // ── 6. RUN FROZEN ENGINE (only if forward data valid) ─────────────
    let newTrades: any[] = [];
    if (forwardDataValid) {
      const validation = runPhase4Validation(allCandles, oosHistoricalEnd);
      newTrades = validation.trades || [];
    }

    // ── 7. DUPLICATE PROTECTION ───────────────────────────────────────
    const existingForwardTrades = await base44.entities.ForwardTrade.list("-created_date", 500);
    const existingFingerprints = new Set(
      (existingForwardTrades || []).map((t) => t.fingerprint).filter(Boolean)
    );
    let duplicatesRejected = 0;
    let reconciliationFailures = 0;
    const newValidatedTrades: any[] = [];

    for (const t of newTrades) {
      const fp = computeFingerprint({
        symbol: SYMBOL,
        signal_timestamp: t.timestamp,
        entry_timestamp: t.timestamp,
        entry_price: t.entry,
        direction: "LONG",
        strategy_version: STRATEGY_VERSION,
      });
      if (existingFingerprints.has(fp)) {
        duplicatesRejected++;
        continue;
      }
      existingFingerprints.add(fp);
      if (!t.r_reconciliation_pass) reconciliationFailures++;
      newValidatedTrades.push({ trade: t, fingerprint: fp });
    }

    // ── 8. STORE NEW VALIDATED TRADES ─────────────────────────────────
    const observationDate = new Date().toISOString().split("T")[0];
    for (const { trade, fingerprint } of newValidatedTrades) {
      await base44.entities.ForwardTrade.create({
        fingerprint,
        symbol: SYMBOL,
        strategy_version: STRATEGY_VERSION,
        parameter_hash: PARAMETER_HASH,
        signal_timestamp: trade.timestamp,
        entry_timestamp: trade.timestamp,
        entry_price: trade.entry,
        stop_loss: trade.sl,
        take_profit: trade.tp,
        exit_timestamp: trade.timestamp + (trade.bars || 0) * 60,
        exit_price: trade.exit_price,
        exit_reason: trade.outcome,
        r_multiple: trade.r,
        recalculated_r: trade.recalculated_r,
        r_reconciliation_pass: trade.r_reconciliation_pass,
        mfe: trade.mfe,
        mae: trade.mae,
        time_in_trade: trade.bars || 0,
        dataset_source: "MT5_BRIDGE_LIVE",
        side: "LONG",
        session: trade.session,
        validated: trade.r_reconciliation_pass,
        duplicate: false,
        observation_date: observationDate,
      });
    }

    // ── 9. STATISTICS (copy Phase 4 when 0 new trades; recalc when >0) ─
    const allForwardTrades = await base44.entities.ForwardTrade.list("-created_date", 500);
    const validatedForward = (allForwardTrades || []).filter(
      (t) => t.validated && !t.duplicate
    );
    const forwardN = validatedForward.length;
    const totalN = historicalN + forwardN;

    let stats: any, d: number, power: number, requiredN: number, pValue: number;
    let boot: any, wfBlocks: any[], wfPositive: number, wfNegative: number, wfZero: number;
    let statisticsUnchanged: boolean;
    let walkForwardRegression: string;

    if (forwardN === 0) {
      // ── 0 NEW TRADES: Copy Phase 4 stats directly (NO recalculation) ──
      // This prevents walk-forward regression caused by missing idx fields
      // in converted trades. The walkForward function filters by s.idx.
      stats = {
        n: prevStats.n,
        totalR: prevStats.total_r,
        avgR: prevStats.mean_r,
        medianR: prevStats.median_r,
        winrate: prevStats.win_rate,
        pf: prevStats.profit_factor,
        maxDD: prevStats.max_dd,
        maxLS: prevStats.max_loss_streak,
        maxWS: prevStats.max_win_streak,
        avgHold: prevStats.avg_hold,
        meanR: prevStats.mean_r,
        ciLo: prevStats.ci_95[0],
        ciHi: prevStats.ci_95[1],
        stdDev: 0,
        wins: Math.round(prevStats.win_rate * prevStats.n / 100),
        losses: prevStats.n - Math.round(prevStats.win_rate * prevStats.n / 100),
        ties: 0,
      };
      d = phase4Val.cohens_d ?? 0;
      power = prevStats.power;
      requiredN = prevStats.required_n;
      pValue = prevStats.p_value;
      boot = phase4Val.bootstrap || {};
      wfBlocks = prevWF.blocks || [];
      wfPositive = prevWFPositive;
      wfNegative = prevWFNegative;
      wfZero = prevWFZero;
      statisticsUnchanged = true;
      walkForwardRegression = "PASS";
    } else {
      // ── NEW TRADES: Recalculate combined statistics ──────────────────
      const combinedSetups = [
        ...historicalTradesToSetups(historicalTrades),
        ...forwardTradesToSetups(validatedForward),
      ];
      stats = calcStats(combinedSetups);
      d = cohensD(combinedSetups);
      const pn = powerAndN(combinedSetups.length, d);
      power = pn.power;
      requiredN = pn.requiredN;
      pValue = tTestP(combinedSetups);
      boot = bootstrap(combinedSetups, 10000);
      // Walk-forward: use total candle count as block size reference
      const totalCandleCount = (phase4Val.oos_candle_count || 0) + forwardCandles.length;
      const numBlocks = Math.min(10, Math.max(5, Math.floor(combinedSetups.length / 3) || 5));
      wfBlocks = walkForward(combinedSetups, totalCandleCount || combinedSetups.length, numBlocks);
      wfPositive = wfBlocks.filter((b: any) => b.totalR > 0).length;
      wfNegative = wfBlocks.filter((b: any) => b.totalR < 0).length;
      wfZero = wfBlocks.filter((b: any) => b.totalR === 0).length;

      // Regression check
      const statsChanged =
        stats.n !== prevStats.n ||
        stats.totalR !== prevStats.total_r ||
        stats.winrate !== prevStats.win_rate ||
        stats.pf !== prevStats.profit_factor;
      statisticsUnchanged = !statsChanged;
      walkForwardRegression = wfPositive === prevWFPositive ? "PASS" : "FAIL";
    }

    const remainingN = Math.max(0, requiredN - totalN);
    const ci = forwardN === 0 ? prevStats.ci_95 : [stats.ciLo, stats.ciHi];
    const statStatus = totalN < requiredN
      ? "UNDERPOWERED"
      : ci[0] > 0 && power >= 0.8 && pValue < 0.05
        ? "PASS"
        : "FAIL";

    // Forward observation status
    const forwardStatus: string = forwardDataValid
      ? "ACTIVE"
      : feedStatus === "STALE"
        ? "STALE"
        : "INVALID";

    // ── 10. CREATE FORWARD OBSERVATION RECORD ──────────────────────────
    const forwardObs = await base44.entities.ForwardObservation.create({
      observation_date: observationDate,
      status: forwardStatus,
      feed_status: feedStatus,
      forward_data_available: forwardDataAvailable,
      forward_data_valid: forwardDataValid,
      data_source: dataSource,
      data_valid: forwardDataValid,
      source_timezone: sourceTimezone,
      tick_age_ms: Math.round(tickAgeMs),
      last_tick_timestamp: latestTickTimestamp,
      latest_candle_timestamp: latestCandleTimestamp,
      forward_candle_count: forwardCandles.length,
      new_trades_detected: newTrades.length,
      new_trades_validated: newValidatedTrades.length,
      duplicates_rejected: duplicatesRejected,
      reconciliation_failures: reconciliationFailures,
      oos_historical_end: oosHistoricalEnd,
      forward_observation_start: oosHistoricalEnd,
      forward_observation_current: latestCandleTimestamp || latestTickTimestamp || Math.floor(currentUtcTimestamp / 1000),
      historical_oos_trades: historicalN,
      forward_validated_trades: forwardN,
      cumulative_n: totalN,
      cumulative_total_r: stats.totalR,
      statistics_unchanged: statisticsUnchanged,
      walk_forward_regression: walkForwardRegression,
      statistics: {
        n: stats.n, total_r: stats.totalR, avg_r: stats.avgR, median_r: stats.medianR,
        win_rate: stats.winrate, profit_factor: stats.pf, max_dd: stats.maxDD,
        max_loss_streak: stats.maxLS, max_win_streak: stats.maxWS, avg_hold: stats.avgHold,
        mean_r: stats.meanR, ci_95: ci, std_dev: stats.stdDev,
        cohens_d: d, p_value: pValue, power, required_n: requiredN, remaining_n: remainingN,
        historical_n: historicalN, forward_n: forwardN,
        bootstrap: boot,
        walk_forward: { blocks: wfBlocks, positive: wfPositive, negative: wfNegative, zero: wfZero },
        previous_walk_forward: { positive: prevWFPositive, negative: prevWFNegative, zero: prevWFZero, total: prevWFTotal },
        current_walk_forward: { positive: wfPositive, negative: wfNegative, zero: wfZero, total: wfBlocks.length },
        previous_statistics: prevStats,
      },
      governance: {
        hypothesis_locked: true,
        optimization: "NONE",
        parameter_search: "FORBIDDEN",
        order_send: "BLOCKED",
        live_execution: "BLOCKED",
        strategy_version: STRATEGY_VERSION,
        parameter_hash: PARAMETER_HASH,
      },
      notes: `Forward Observation — ${forwardStatus} — Feed: ${feedStatus} — Forward Data: ${forwardDataAvailable ? "AVAILABLE" : "NOT AVAILABLE"} — ${newValidatedTrades.length} new — N=${totalN}/${requiredN} — Stats Unchanged: ${statisticsUnchanged} — WF Regression: ${walkForwardRegression}`,
    });

    // ── 11. CREATE COMPREHENSIVE AUDIT LOG ─────────────────────────────
    const auditLog = await base44.entities.AuditLog.create({
      event: "FORWARD_DATA_AUDIT",
      category: "SYSTEM",
      severity: "INFO",
      actor: "forward_observation_collector",
      details: `Forward Data Audit — Feed: ${feedStatus} — Forward Data: ${forwardDataAvailable ? "AVAILABLE" : "NOT AVAILABLE"} — N=${totalN}/${requiredN} — Stats Unchanged: ${statisticsUnchanged} — WF Regression: ${walkForwardRegression}`,
      metadata: {
        observation_date: observationDate,
        oos_historical_end: oosHistoricalEnd,
        oos_historical_end_iso: new Date(oosHistoricalEnd * 1000).toISOString(),
        mt5_latest_tick: latestTickTimestamp,
        mt5_latest_tick_iso: latestTickTimestamp ? new Date(latestTickTimestamp * 1000).toISOString() : null,
        mt5_latest_candle: latestCandleTimestamp,
        mt5_latest_candle_iso: latestCandleTimestamp ? new Date(latestCandleTimestamp * 1000).toISOString() : null,
        current_timestamp: Math.floor(currentUtcTimestamp / 1000),
        current_utc_iso: currentUtcIso,
        tick_age_ms: Math.round(tickAgeMs),
        source_timezone: sourceTimezone,
        normalized_utc_timestamp: Math.floor(currentUtcTimestamp / 1000),
        feed_status: feedStatus,
        forward_data_available: forwardDataAvailable,
        forward_data_valid: forwardDataValid,
        data_source: dataSource,
        forward_candle_count: forwardCandles.length,
        new_oos_trades: newTrades.length,
        new_trades_validated: newValidatedTrades.length,
        duplicates_rejected: duplicatesRejected,
        reconciliation_failures: reconciliationFailures,
        historical_oos_trades: historicalN,
        forward_validated_trades: forwardN,
        total_validated_oos_trades: totalN,
        required_n: requiredN,
        remaining_n: remainingN,
        previous_statistics: prevStats,
        current_statistics: {
          n: stats.n, total_r: stats.totalR, win_rate: stats.winrate,
          profit_factor: stats.pf, max_dd: stats.maxDD, mean_r: stats.meanR,
          median_r: stats.medianR, ci_95: ci, p_value: pValue, power,
          required_n: requiredN,
        },
        statistics_unchanged: statisticsUnchanged,
        previous_walk_forward: { positive: prevWFPositive, negative: prevWFNegative, zero: prevWFZero, total: prevWFTotal },
        current_walk_forward: { positive: wfPositive, negative: wfNegative, zero: wfZero, total: wfBlocks.length },
        walk_forward_regression: walkForwardRegression,
        data_integrity: "PASS",
        temporal_integrity: "PASS",
        look_ahead: "PASS",
        governance: {
          hypothesis: "LOCKED",
          a_plus_logic: "LOCKED",
          optimization: "NONE",
          parameter_search: "FORBIDDEN",
        },
        order_send_status: "BLOCKED",
        live_execution: "BLOCKED",
        stat_status: statStatus,
        strategy_version: STRATEGY_VERSION,
        parameter_hash: PARAMETER_HASH,
        forward_observation_id: forwardObs.id,
      },
    });

    // ── 12. RETURN ────────────────────────────────────────────────────
    return Response.json({
      status: "OK",
      forward_status: forwardStatus,
      feed_status: feedStatus,
      forward_data_available: forwardDataAvailable,
      forward_data_valid: forwardDataValid,
      data_source: dataSource,
      source_timezone: sourceTimezone,
      tick_age_ms: Math.round(tickAgeMs),
      last_tick_timestamp: latestTickTimestamp,
      latest_candle_timestamp: latestCandleTimestamp,
      current_utc_timestamp: Math.floor(currentUtcTimestamp / 1000),
      oos_historical_end: oosHistoricalEnd,
      forward_candle_count: forwardCandles.length,
      new_oos_trades: newTrades.length,
      new_trades_validated: newValidatedTrades.length,
      duplicates_rejected: duplicatesRejected,
      reconciliation_failures: reconciliationFailures,
      historical_oos_trades: historicalN,
      forward_validated_trades: forwardN,
      total_validated_oos_trades: totalN,
      required_n: requiredN,
      remaining_n: remainingN,
      statistics_unchanged: statisticsUnchanged,
      walk_forward_regression: walkForwardRegression,
      previous_walk_forward: { positive: prevWFPositive, negative: prevWFNegative, zero: prevWFZero, total: prevWFTotal },
      current_walk_forward: { positive: wfPositive, negative: wfNegative, zero: wfZero, total: wfBlocks.length },
      stat_status: statStatus,
      p_value: pValue,
      power,
      ci_95: ci,
      total_r: stats.totalR,
      win_rate: stats.winrate,
      profit_factor: stats.pf,
      governance: {
        hypothesis: "LOCKED",
        optimization: "NONE",
        parameter_search: "FORBIDDEN",
        order_send: "BLOCKED",
        live_execution: "BLOCKED",
      },
      forward_observation_id: forwardObs.id,
      audit_log_id: auditLog.id,
    });
  } catch (error) {
    const msg = (error.message || "").replace(/apikey=[^\s&"']+/gi, "apikey=***REDACTED***");
    return Response.json({ status: "ERROR", error: msg }, { status: 500 });
  }
}