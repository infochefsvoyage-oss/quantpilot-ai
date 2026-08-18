// QuantPilot – ICT Pipeline Read-Only Performance Snapshot
// Pipeline: MT5 XAUUSD → Bridge (tick + M1 rates) → QuantPilot → ICT Engine → Dashboard
//
// Fetches tick + M1 candles + account + positions + heartbeat from the bridge,
// measures every latency, evaluates tick/candle freshness, and returns the raw
// candles for the frontend ICT engine to analyse. No order is ever sent;
// execution stays BLOCKED. READ_ONLY = ON, ORDER_CHECK = ALLOWED, ORDER_SEND = BLOCKED.
//
// Secrets: MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, FRESHNESS_THRESHOLD_MS, M1_MS, fetchJson, computeTickAgeMs, getServerTimeMs, mapPositions, heartbeatFields } from '../../shared/mt5Bridge.ts';

const CANDLE_COUNT = 100;

export default async function(req) {
  const tStart = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    const now = new Date().toISOString();
    if (!bridgeUrl) {
      return Response.json({
        symbol: SYMBOL, reachable: false, bridge_tier: "UI_CONTRACT",
        error: "MT5_BRIDGE_URL not configured", live_execution_blocked: true, fetched_at: now,
      });
    }
    const headers = apiKey ? { "X-API-Key": apiKey } : {};
    const base = bridgeUrl.replace(/\/+$/, "");
    const latencies = {};

    // 1) Bridge health
    const health = await fetchJson(`${base}/health`, headers);
    latencies.health_ms = health.latency_ms;
    if (!health.ok) {
      return Response.json({
        symbol: SYMBOL, reachable: false, bridge_tier: "UI_CONTRACT",
        error: `bridge /health failed (HTTP ${health.status || 'timeout'})`,
        latencies, live_execution_blocked: true, fetched_at: now,
      });
    }

    // 2) Read endpoints (parallel) — tick, rates, account, positions, heartbeat
    const [tick, rates, acc, pos, hbRaw] = await Promise.all([
      fetchJson(`${base}/symbols/${SYMBOL}/tick`, headers),
      fetchJson(`${base}/symbols/${SYMBOL}/rates?timeframe=M1&count=${CANDLE_COUNT}`, headers),
      fetchJson(`${base}/account`, headers),
      fetchJson(`${base}/positions`, headers),
      fetchJson(`${base}/heartbeat`, headers),
    ]);
    latencies.tick_ms = tick.latency_ms;
    latencies.rates_ms = rates.latency_ms;
    latencies.account_ms = acc.latency_ms;
    latencies.positions_ms = pos.latency_ms;
    latencies.heartbeat_ms = hbRaw.latency_ms;

    const tickJ = tick.json || {};
    const ratesJ = rates.ok ? (rates.json || {}) : {};
    const account = (acc.json && acc.json.account) || {};
    const positions = (pos.json && pos.json.positions) || [];
    const heartbeat = hbRaw.json || {};

    // 3) Tick freshness
    const tickAgeMs = computeTickAgeMs(tickJ);
    const tickFresh = tickAgeMs !== null && tickAgeMs <= FRESHNESS_THRESHOLD_MS;
    const serverTimeMs = getServerTimeMs(tickJ);
    const hb = heartbeatFields(heartbeat);

    // 4) M1 candle completeness — check for gaps > 1.5 × M1
    const candles = (ratesJ.candles || ratesJ.rates || []).map(c => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
      tick_volume: c.tick_volume || 0,
    }));
    let candleGaps = 0;
    for (let i = 1; i < candles.length; i++) {
      const gap = (candles[i].time - candles[i - 1].time) * 1000;
      if (gap > M1_MS * 1.5) candleGaps++;
    }
    const lastCandleTimeMs = candles.length > 0 ? candles[candles.length - 1].time * 1000 : null;
    // ── TIMEBASE NORMALIZATION — DO NOT REMOVE ──────────────────────────────
    // MT5's copy_rates_from_pos returns candle `time` in BROKER SERVER TIME
    // (Vantage = EET/UTC+3), NOT in UTC. Date.now() and bridge server_time_ms
    // are both UTC. Without correction, Date.now() - (candle.time * 1000) is
    // negative by ~3h (≈ -10.8M ms), making ICT_CANDLE_LATENCY unusable.
    //
    // The offset is computed DYNAMICALLY from the tick response (not hardcoded)
    // because: (a) DST shifts EET between UTC+2 and UTC+3, (b) different brokers
    // use different server timezones, (c) it stays correct if the bridge host
    // clock drifts. tickJ.time is MT5 broker time; serverTimeMs is bridge UTC.
    // Their difference IS the broker→UTC offset, applied to normalize the
    // candle timestamp before computing its age.
    // ────────────────────────────────────────────────────────────────────────
    const brokerOffsetMs = (tickJ.time && serverTimeMs) ? (tickJ.time * 1000) - serverTimeMs : 0;
    const lastCandleAgeMs = lastCandleTimeMs !== null ? Date.now() - lastCandleTimeMs + brokerOffsetMs : null;
    const candleComplete = candles.length >= CANDLE_COUNT * 0.95 && candleGaps === 0;

    // 5) Build snapshot — candles are raw; frontend ICT engine runs the analysis
    const snapshot = {
      symbol: SYMBOL,
      bid: tickJ.bid ?? null, ask: tickJ.ask ?? null,
      spread: (tickJ.ask != null && tickJ.bid != null) ? tickJ.ask - tickJ.bid : null,
      tick_age_ms: tickAgeMs, tick_fresh: tickFresh,
      balance: account.balance ?? null, equity: account.equity ?? null,
      margin: account.margin ?? null, free_margin: account.free_margin ?? null,
      currency: account.currency || null, account_fresh: acc.ok,
      positions: mapPositions(positions),
      positions_count: positions.length, positions_fresh: pos.ok,
      ...hb,
      last_heartbeat_at: heartbeat.last_heartbeat_at || null,
      candles, candle_count: candles.length, candle_gaps: candleGaps,
      candle_complete: candleComplete, last_candle_age_ms: lastCandleAgeMs,
      rates_available: rates.ok,
      server_time_ms: serverTimeMs,
      ingestion_latency_ms: Date.now() - tStart,
      bridge_tier: "BACKEND_CONNECTED",
      live_execution_blocked: true,
      latencies, reachable: true,
      error: rates.ok ? null : `rates endpoint: HTTP ${rates.status} (bridge needs /symbols/{symbol}/rates)`,
      fetched_at: now,
    };

    return Response.json(snapshot);
  } catch (error) {
    return Response.json({
      error: error.message, reachable: false, bridge_tier: "UI_CONTRACT",
      live_execution_blocked: true, fetched_at: new Date().toISOString(),
    }, { status: 500 });
  }
}