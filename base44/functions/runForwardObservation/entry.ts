// QuantPilot — Forward Observation Collector
// Collects new OOS trades from LIVE MT5 bridge data (strictly after OOS_HISTORICAL_END).
// FROZEN hypothesis: NO optimization, NO parameter changes, NO order execution.
// Duplicate-protected, R-reconciled, daily-audited.
//
// Secrets: MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, fetchCandleHistory } from '../../shared/mt5Bridge.ts';
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

    // ── 2. LIVE DATA: Fetch from MT5 Bridge ────────────────────────────
    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    if (!bridgeUrl) {
      return Response.json({ status: "INVALID", reason: "NO_BRIDGE_URL" });
    }

    const headers = apiKey ? { "X-API-Key": apiKey } : {};
    const base = bridgeUrl.replace(/\/+$/, "");

    let allCandles: any[] = [];
    let bridgeReachable = false;
    try {
      const result = await fetchCandleHistory(base, headers, SYMBOL, "M1", FETCH_CANDLES, BATCH_SIZE);
      allCandles = result.candles || [];
      bridgeReachable = allCandles.length > 0;
    } catch {
      bridgeReachable = false;
    }

    // ── 3. DATA FRESHNESS CHECK ───────────────────────────────────────
    const latestCandle = allCandles.length > 0 ? allCandles[allCandles.length - 1] : null;
    const nowSec = Date.now() / 1000;
    const tickAgeMs = latestCandle ? (nowSec - latestCandle.time) * 1000 : 999999;
    const dataValid = bridgeReachable && tickAgeMs < STALE_THRESHOLD_MS;
    const feedStatus = !bridgeReachable
      ? "DISCONNECTED"
      : tickAgeMs >= STALE_THRESHOLD_MS
        ? "STALE"
        : "LIVE";
    const forwardStatus: string = dataValid
      ? "ACTIVE"
      : feedStatus === "STALE"
        ? "STALE"
        : "INVALID";

    // ── 4. FORWARD CANDLES (strictly > OOS_HISTORICAL_END) ────────────
    const forwardCandles = allCandles.filter((c) => c.time > oosHistoricalEnd);
    const forwardObservationStart = oosHistoricalEnd;
    const forwardObservationCurrent = latestCandle?.time || nowSec;

    // ── 5. RUN FROZEN ENGINE (NY-LONG, no optimization) ───────────────
    let newTrades: any[] = [];
    if (dataValid && forwardCandles.length > 0) {
      const validation = runPhase4Validation(allCandles, oosHistoricalEnd);
      newTrades = validation.trades || [];
    }

    // ── 6. DUPLICATE PROTECTION ───────────────────────────────────────
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

    // ── 7. STORE NEW VALIDATED TRADES ─────────────────────────────────
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

    // ── 8. COMBINED STATISTICS (historical + forward) ─────────────────
    const allForwardTrades = await base44.entities.ForwardTrade.list("-created_date", 500);
    const validatedForward = (allForwardTrades || []).filter(
      (t) => t.validated && !t.duplicate
    );

    const combinedSetups = [
      ...historicalTradesToSetups(historicalTrades),
      ...forwardTradesToSetups(validatedForward),
    ];

    const stats = calcStats(combinedSetups);
    const d = cohensD(combinedSetups);
    const { power, requiredN } = powerAndN(combinedSetups.length, d);
    const pValue = tTestP(combinedSetups);
    const boot = bootstrap(combinedSetups, 10000);
    const numBlocks = Math.min(10, Math.max(5, Math.floor(combinedSetups.length / 3) || 5));
    const wfBlocks = walkForward(combinedSetups, combinedSetups.length, numBlocks);

    const remainingN = Math.max(0, requiredN - stats.n);
    const ci = [stats.ciLo, stats.ciHi];
    const statValidationPass =
      stats.n >= requiredN && ci[0] > 0 && power >= 0.8 && pValue < 0.05;
    const statStatus =
      stats.n < requiredN ? "UNDERPOWERED" : statValidationPass ? "PASS" : "FAIL";

    const wfPositive = wfBlocks.filter((b: any) => b.totalR > 0).length;
    const wfNegative = wfBlocks.filter((b: any) => b.totalR < 0).length;
    const wfZero = wfBlocks.filter((b: any) => b.totalR === 0).length;

    // ── 9. CREATE FORWARD OBSERVATION RECORD ──────────────────────────
    const forwardObs = await base44.entities.ForwardObservation.create({
      observation_date: observationDate,
      status: forwardStatus,
      data_source: "MT5_BRIDGE_LIVE",
      data_valid: dataValid,
      tick_age_ms: Math.round(tickAgeMs),
      last_tick_timestamp: latestCandle?.time || 0,
      forward_candle_count: forwardCandles.length,
      new_trades_detected: newTrades.length,
      new_trades_validated: newValidatedTrades.length,
      duplicates_rejected: duplicatesRejected,
      reconciliation_failures: reconciliationFailures,
      oos_historical_end: oosHistoricalEnd,
      forward_observation_start: forwardObservationStart,
      forward_observation_current: forwardObservationCurrent,
      cumulative_n: stats.n,
      cumulative_total_r: stats.totalR,
      statistics: {
        n: stats.n,
        total_r: stats.totalR,
        avg_r: stats.avgR,
        median_r: stats.medianR,
        win_rate: stats.winrate,
        profit_factor: stats.pf,
        max_dd: stats.maxDD,
        max_loss_streak: stats.maxLS,
        max_win_streak: stats.maxWS,
        avg_hold: stats.avgHold,
        mean_r: stats.meanR,
        ci_95: ci,
        std_dev: stats.stdDev,
        cohens_d: d,
        p_value: pValue,
        power,
        required_n: requiredN,
        remaining_n: remainingN,
        historical_n: historicalN,
        forward_n: validatedForward.length,
        bootstrap: boot,
        walk_forward: {
          blocks: wfBlocks,
          positive: wfPositive,
          negative: wfNegative,
          zero: wfZero,
        },
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
      notes: `Forward Observation — ${forwardStatus} — ${newValidatedTrades.length} new — ${duplicatesRejected} dup — N=${stats.n}/${requiredN} — Feed: ${feedStatus}`,
    });

    // ── 10. CREATE AUDIT LOG ──────────────────────────────────────────
    const auditLog = await base44.entities.AuditLog.create({
      event: "FORWARD_OBSERVATION_RUN",
      category: "SYSTEM",
      severity: "INFO",
      actor: "forward_observation_collector",
      details: `Forward Observation — ${forwardStatus} — ${newValidatedTrades.length} new trades — ${duplicatesRejected} duplicates — N=${stats.n}/${requiredN} — Tick Age: ${Math.round(tickAgeMs)}ms — Feed: ${feedStatus}`,
      metadata: {
        observation_date: observationDate,
        status: forwardStatus,
        feed_status: feedStatus,
        data_valid: dataValid,
        tick_age_ms: Math.round(tickAgeMs),
        last_tick_timestamp: latestCandle?.time || 0,
        forward_candle_count: forwardCandles.length,
        new_trades_detected: newTrades.length,
        new_trades_validated: newValidatedTrades.length,
        duplicates_rejected: duplicatesRejected,
        reconciliation_failures: reconciliationFailures,
        oos_historical_end: oosHistoricalEnd,
        forward_observation_start: forwardObservationStart,
        forward_observation_current: forwardObservationCurrent,
        cumulative_n: stats.n,
        cumulative_total_r: stats.totalR,
        required_n: requiredN,
        remaining_n: remainingN,
        p_value: pValue,
        power,
        ci_95: ci,
        stat_status: statStatus,
        historical_n: historicalN,
        forward_n: validatedForward.length,
        walk_forward: { positive: wfPositive, negative: wfNegative, zero: wfZero, total: wfBlocks.length },
        strategy_version: STRATEGY_VERSION,
        parameter_hash: PARAMETER_HASH,
        order_send: "BLOCKED",
        live_execution: "BLOCKED",
        forward_observation_id: forwardObs.id,
      },
    });

    // ── 11. RETURN ────────────────────────────────────────────────────
    return Response.json({
      status: "OK",
      forward_status: forwardStatus,
      feed_status: feedStatus,
      data_valid: dataValid,
      tick_age_ms: Math.round(tickAgeMs),
      last_tick_timestamp: latestCandle?.time || 0,
      forward_candle_count: forwardCandles.length,
      new_trades_detected: newTrades.length,
      new_trades_validated: newValidatedTrades.length,
      duplicates_rejected: duplicatesRejected,
      reconciliation_failures: reconciliationFailures,
      oos_historical_end: oosHistoricalEnd,
      forward_observation_start: forwardObservationStart,
      forward_observation_current: forwardObservationCurrent,
      cumulative_n: stats.n,
      cumulative_total_r: stats.totalR,
      required_n: requiredN,
      remaining_n: remainingN,
      p_value: pValue,
      power,
      ci_95: ci,
      stat_status: statStatus,
      historical_n: historicalN,
      forward_n: validatedForward.length,
      walk_forward: { positive: wfPositive, negative: wfNegative, zero: wfZero, total: wfBlocks.length },
      governance: {
        hypothesis_locked: true,
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