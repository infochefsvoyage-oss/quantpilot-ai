// QuantPilot — Phase 4 Independent OOS Validation Pipeline
// Fetches independent XAUUSD M1 data from Twelve Data, runs the FROZEN
// NY-LONG hypothesis, calculates full statistics, persists AuditLog.
//
// NO optimization. NO parameter changes. NO simulation. NO fake OOS.
// Real orders BLOCKED. Live execution BLOCKED.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { validateCandleData } from '../../shared/forexDataQuality.ts';
import { runPhase4Validation } from '../../shared/phase4Engine.ts';
import { fetchTwelveDataBatch, fmtDateTime, sleep, resolveApiKeyAndProvider, BATCH_SIZE, THROTTLE_MS } from '../../shared/twelveDataClient.ts';

const MAX_BATCHES = 12;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // ── Resolve API key (prefer URL-embedded key) ─────────────────────
    const { apiKey, provider: _provider } = resolveApiKeyAndProvider(
      secrets.get("FOREX_DATA_API_KEY"),
      secrets.get("FOREX_DATA_PROVIDER")
    );
    if (!apiKey) {
      return Response.json({ oos_data_available: false, status: "NO_API_KEY", error: "FOREX_DATA_API_KEY not set" });
    }

    const body = await req.json().catch(() => ({}));
    const maxBatches = Math.min(body.max_batches || MAX_BATCHES, 12);
    const discoveryEndUnix = body.discovery_end_unix || null;

    // ── Fetch candles from Twelve Data ─────────────────────────────────
    let allCandles: Candle[] = [];
    let cursor: string | null = null;
    for (let b = 0; b < maxBatches; b++) {
      const batch = await fetchTwelveDataBatch(apiKey, cursor);
      if (batch.length === 0) break;
      allCandles.push(...batch);
      cursor = fmtDateTime(batch[0].time - 1);
      if (b < maxBatches - 1) await sleep(THROTTLE_MS);
    }

    // ── Deduplicate + sort ────────────────────────────────────────────
    const seen = new Set<number>();
    const deduped: Candle[] = [];
    let rawDuplicates = 0;
    for (const c of allCandles) {
      if (!seen.has(c.time)) { seen.add(c.time); deduped.push(c); }
      else rawDuplicates++;
    }
    deduped.sort((a, b) => a.time - b.time);

    // ── Data integrity gate ───────────────────────────────────────────
    const rawCount = allCandles.length;
    const finalCount = deduped.length;
    let ohlcErrors = 0, timeErrors = 0;
    for (const c of deduped) {
      if (!(c.low <= c.open && c.low <= c.close && c.high >= c.open && c.high >= c.close && c.low <= c.high)) ohlcErrors++;
      if (!isFinite(c.time) || c.time <= 0) timeErrors++;
    }

    // Gap analysis
    const expectedStep = 60; // M1
    const gaps: any[] = [];
    for (let i = 1; i < deduped.length; i++) {
      const dt = deduped[i].time - deduped[i - 1].time;
      if (dt !== expectedStep) {
        // Classify: weekend closure (Fri 22:00 UTC - Sun 22:00 UTC) or daily closure
        const prevDay = new Date(deduped[i - 1].time * 1000).getUTCDay();
        const currDay = new Date(deduped[i].time * 1000).getUTCDay();
        const isWeekend = (prevDay === 5 && currDay === 0) || (prevDay === 5 && currDay === 6) || (prevDay === 6 && currDay === 0);
        gaps.push({ idx: i, expected: expectedStep, actual: dt, type: isWeekend ? "WEEKEND_CLOSURE" : "REAL_GAP", prev_time: deduped[i - 1].time, curr_time: deduped[i].time });
      }
    }
    const realGaps = gaps.filter(g => g.type === "REAL_GAP");
    const weekendClosures = gaps.filter(g => g.type === "WEEKEND_CLOSURE");

    const dataIntegrityPass = ohlcErrors === 0 && timeErrors === 0 && realGaps.length === 0 && deduped.length >= 30000;

    // ── Quality gate ──────────────────────────────────────────────────
    const quality = validateCandleData(deduped, {
      expectedSymbol: "XAUUSD",
      expectedTimeframe: "M1",
      minCandles: 30000,
    });

    // ── OOS boundary check ────────────────────────────────────────────
    const oosStart = deduped.length > 0 ? deduped[0].time : null;
    const oosEnd = deduped.length > 0 ? deduped[deduped.length - 1].time : null;
    const independentOOS = !discoveryEndUnix || (oosStart !== null && oosStart > discoveryEndUnix);

    // ── Run Phase 4 validation (FROZEN hypothesis) ────────────────────
    const validation = runPhase4Validation(deduped, discoveryEndUnix);

    // ── Build AuditLog ───────────────────────────────────────────────
    const remainingN = Math.max(0, 82 - (validation.trade_count || 0));
    const auditMetadata = {
      timestamp: new Date().toISOString(),
      phase: "PHASE_4_INDEPENDENT_OOS_EXTENSION",
      provider: "twelvedata",
      symbol: "XAU/USD",
      timeframe: "1min",
      raw_candles: rawCount,
      final_candles: finalCount,
      raw_duplicates: rawDuplicates,
      final_duplicates: 0,
      ohlc_errors: ohlcErrors,
      time_errors: timeErrors,
      gap_count: gaps.length,
      real_gaps: realGaps.length,
      weekend_closures: weekendClosures.length,
      expected_closures: weekendClosures.length,
      oldest: oosStart ? new Date(oosStart * 1000).toISOString() : null,
      newest: oosEnd ? new Date(oosEnd * 1000).toISOString() : null,
      discovery_end: discoveryEndUnix ? new Date(discoveryEndUnix * 1000).toISOString() : null,
      oos_start: oosStart ? new Date(oosStart * 1000).toISOString() : null,
      oos_end: oosEnd ? new Date(oosEnd * 1000).toISOString() : null,
      independent_oos: independentOOS,
      data_integrity: dataIntegrityPass ? "PASS" : "FAIL",
      data_quality_gate: quality.pass ? "PASS" : "FAIL",
      remaining_n: remainingN,
      ...validation,
    };

    const auditLog = await base44.entities.AuditLog.create({
      event: "NY_LONG_PHASE_4_OOS_VALIDATION",
      category: "SYSTEM",
      severity: "INFO",
      actor: "phase4_pipeline",
      details: `A+ NY-LONG Phase 4 Independent OOS Extension — ${validation.classification} — ${validation.trade_count} trades — ${validation.oos_candle_count} OOS candles — Remaining N: ${remainingN}`,
      metadata: auditMetadata,
    });

    return Response.json({
      status: "OK",
      provider: "twelvedata",
      symbol: "XAU/USD",
      timeframe: "1min",
      raw_candles: rawCount,
      final_candles: finalCount,
      raw_duplicates: rawDuplicates,
      ohlc_errors: ohlcErrors,
      time_errors: timeErrors,
      gap_count: gaps.length,
      real_gaps: realGaps.length,
      weekend_closures: weekendClosures.length,
      data_integrity: dataIntegrityPass ? "PASS" : "FAIL",
      data_quality_gate: quality.pass ? "PASS" : "FAIL",
      oos_range: { start: oosStart, end: oosEnd },
      discovery_end: discoveryEndUnix,
      independent_oos: independentOOS,
      validation,
      audit_log_id: auditLog.id,
      order_send: "BLOCKED",
      live_execution: "BLOCKED",
    });
  } catch (error) {
    const rawMsg = error.message || "";
    const msg = rawMsg.replace(/apikey=[^\s&"']+/gi, "apikey=***REDACTED***")
                      .replace(/api_key=[^\s&"']+/gi, "api_key=***REDACTED***");
    const isAuthError = msg.includes("apikey") || msg.includes("API key") ||
                        msg.includes("incorrect") || msg.includes("unauthorized") ||
                        msg.includes("Invalid API") || msg.includes("401");
    return Response.json({
      oos_data_available: false,
      status: isAuthError ? "PROVIDER_AUTH_INVALID" : "ERROR",
      error: isAuthError ? "Provider credentials invalid or rejected" : msg,
    }, { status: isAuthError ? 401 : 500 });
  }
}