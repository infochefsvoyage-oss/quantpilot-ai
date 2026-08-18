// QuantPilot – MT5 Read-Only Operational Snapshot
// Pipeline: Vantage MT5 → MetaTrader5 Python → FastAPI Bridge → (this function) → QuantPilot → React Dashboard
//
// Calls the external bridge read endpoints, measures latencies, evaluates freshness,
// reconciles bridge vs /verification, persists a snapshot + any mismatches, and returns
// the consolidated snapshot to the dashboard. No order is ever sent; execution stays BLOCKED.
//
// Secrets: MT5_BRIDGE_URL (public bridge base, incl. /api/v1/mt5), MT5_BRIDGE_API_KEY.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, FRESHNESS_THRESHOLD_MS, fetchJson, computeTickAgeMs, getServerTimeMs, mapPositions, heartbeatFields } from '../../shared/mt5Bridge.ts';

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

    // 1) Bridge health — if this fails, nothing else is reachable
    const health = await fetchJson(`${base}/health`, headers);
    latencies.health_ms = health.latency_ms;
    if (!health.ok) {
      return Response.json({
        symbol: SYMBOL, reachable: false, bridge_tier: "UI_CONTRACT",
        error: `bridge /health failed (HTTP ${health.status || 'timeout'})`,
        latencies, live_execution_blocked: true, fetched_at: now,
      });
    }

    // 2) Read endpoints (parallel) — tick, account, symbol, positions, orders, heartbeat, verification
    const [ver, acc, tick, pos, ord, hbRaw] = await Promise.all([
      fetchJson(`${base}/verification`, headers),
      fetchJson(`${base}/account`, headers),
      fetchJson(`${base}/symbols/${SYMBOL}/tick`, headers),
      fetchJson(`${base}/positions`, headers),
      fetchJson(`${base}/orders`, headers),
      fetchJson(`${base}/heartbeat`, headers),
    ]);
    latencies.verification_ms = ver.latency_ms;
    latencies.account_ms = acc.latency_ms;
    latencies.tick_ms = tick.latency_ms;
    latencies.positions_ms = pos.latency_ms;
    latencies.orders_ms = ord.latency_ms;
    latencies.heartbeat_ms = hbRaw.latency_ms;

    const verification = ver.json || {};
    const account = (acc.json && acc.json.account) || {};
    const tickJ = tick.json || {};
    const positions = (pos.json && pos.json.positions) || [];
    const orders = (ord.json && ord.json.pending_orders) || [];
    const heartbeat = hbRaw.json || {};

    // 3) Freshness evaluation — primary basis is bridge server_time_ms (bridge host
    //    clock, same host as MT5 → no cross-host clock skew). tick_age_ms measures
    //    how stale the bridge's own timestamp is relative to Base44 now.
    const tickAgeMs = computeTickAgeMs(tickJ);
    const tickFresh = tickAgeMs !== null && tickAgeMs <= FRESHNESS_THRESHOLD_MS;
    const serverTimeMs = getServerTimeMs(tickJ);
    const hb = heartbeatFields(heartbeat);

    // 4) Reconciliation: bridge data vs /verification (single source of truth on bridge side)
    const reconciliation = {
      tick_match: verification.tick === true && tickJ.available === true,
      account_match: verification.account === true && acc.ok && (acc.json ? acc.json.connected : false) !== false,
      positions_match: verification.positions === true,
      heartbeat_match: verification.heartbeat === true && hb.heartbeat_fresh,
    };

    const snapshot = {
      symbol: SYMBOL,
      bid: tickJ.bid ?? null, ask: tickJ.ask ?? null, last: tickJ.last ?? null,
      tick_time: tickJ.time ? tickJ.time * 1000 : null,
      spread: (tickJ.ask != null && tickJ.bid != null) ? tickJ.ask - tickJ.bid : null,
      tick_age_ms: tickAgeMs, tick_fresh: tickFresh,
      balance: account.balance ?? null, equity: account.equity ?? null,
      margin: account.margin ?? null, free_margin: account.free_margin ?? null,
      currency: account.currency || null, account_fresh: acc.ok,
      positions: mapPositions(positions),
      positions_count: positions.length, positions_fresh: pos.ok,
      orders_count: orders.length,
      ...hb,
      last_heartbeat_at: heartbeat.last_heartbeat_at || null,
      heartbeat_last_success_at: heartbeat.last_success_at || null,
      heartbeat_last_failure_at: heartbeat.last_failure_at || null,
      heartbeat_consecutive_failures: typeof heartbeat.consecutive_failures === "number" ? heartbeat.consecutive_failures : 0,
      server_time_ms: serverTimeMs,
      ingestion_latency_ms: Date.now() - tStart,
      bridge_tier: verification.tier || "BACKEND_CONNECTED",
      live_execution_blocked: verification.live_execution_blocked ?? true,
      latencies, reconciliation, reachable: true, error: null, fetched_at: now,
    };

    // 5) Persist snapshot (service role) — fire-and-forget, does not block the response.
    const persistSnapshot = base44.asServiceRole.entities.MT5DataSnapshot.create(snapshot).catch(() => {});

    // 6) Log mismatches — no auto-correction, just the record (also non-blocking)
    const mismatches = [];
    if (!reconciliation.tick_match) mismatches.push({ field: "tick", bridge_value: String(tickJ.available), quantpilot_value: String(verification.tick), severity: "CRITICAL" });
    if (!reconciliation.account_match) mismatches.push({ field: "account", bridge_value: String(acc.ok), quantpilot_value: String(verification.account), severity: "CRITICAL" });
    if (!reconciliation.positions_match) mismatches.push({ field: "positions", bridge_value: String(positions.length), quantpilot_value: String(verification.positions), severity: "WARNING" });
    if (!reconciliation.heartbeat_match) mismatches.push({ field: "heartbeat", bridge_value: hb.heartbeat_state, quantpilot_value: String(verification.heartbeat), severity: "CRITICAL" });
    const persistMismatches = Promise.all(
      mismatches.map((m) => base44.asServiceRole.entities.DataMismatch.create({ source: "MT5_RECONCILIATION", timestamp: now, dashboard_value: null, ...m }).catch(() => {}))
    );

    void Promise.all([persistSnapshot, persistMismatches]);

    return Response.json(snapshot);
  } catch (error) {
    return Response.json({ error: error.message, reachable: false, bridge_tier: "UI_CONTRACT", live_execution_blocked: true, fetched_at: new Date().toISOString() }, { status: 500 });
  }
}