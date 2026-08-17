// QuantPilot – MT5 Read-Only Operational Snapshot
// Pipeline: Vantage MT5 → MetaTrader5 Python → FastAPI Bridge → (this function) → QuantPilot → React Dashboard
//
// Calls the external bridge read endpoints, measures latencies, evaluates freshness,
// reconciles bridge vs /verification, persists a snapshot + any mismatches, and returns
// the consolidated snapshot to the dashboard. No order is ever sent; execution stays BLOCKED.
//
// Secrets: MT5_BRIDGE_URL (public bridge base, incl. /api/v1/mt5), MT5_BRIDGE_API_KEY.
// Until the operator exposes the bridge and sets the secrets, this returns an honest
// "not configured / unreachable" result — never a simulated PASS.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const SYMBOL = "XAUUSD";
const FRESHNESS_THRESHOLD_MS = 5000;

// Bridge tick response shape (subset we consume). server_time_ms is the bridge
// host clock — same host as MT5 — and is the primary time basis for tick_age_ms.
interface BridgeTickResponse {
  bid?: number;
  ask?: number;
  last?: number;
  time?: number;          // MT5 tick time (seconds since epoch) — kept as data field only
  server_time_ms?: number; // bridge host clock (ms) — primary freshness basis
  available?: boolean;
}

async function fetchJson(url, headers, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const body = await res.text();
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, json: null, latency_ms: Date.now() - t0, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

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
    const [ver, acc, tick, pos, ord, hb] = await Promise.all([
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
    latencies.heartbeat_ms = hb.latency_ms;

    const verification = ver.json || {};
    const account = (acc.json && acc.json.account) || {};
    const tickJ = tick.json || {};
    const positions = (pos.json && pos.json.positions) || [];
    const orders = (ord.json && ord.json.pending_orders) || [];
    const heartbeat = hb.json || {};

    // 3) Freshness evaluation — primary basis is bridge server_time_ms (bridge host
    //    clock, same host as MT5 → no cross-host clock skew). tick_age_ms measures
    //    how stale the bridge's own timestamp is relative to Base44 now. tick.time
    //    (MT5 tick time) is kept as a data field but is NOT used for age calculation.
    //    Fallback: if server_time_ms is missing/invalid, use the legacy tick.time
    //    based calculation against Date.now().
    const tickMs: BridgeTickResponse = tickJ;
    const tickTimeMs = tickMs.time ? tickMs.time * 1000 : null;
    const serverTimeMs = typeof tickMs.server_time_ms === "number" && tickMs.server_time_ms > 0
      ? tickMs.server_time_ms : null;
    let tickAgeMs: number | null;
    if (serverTimeMs !== null) {
      tickAgeMs = Math.max(0, Date.now() - serverTimeMs);
    } else if (tickTimeMs !== null) {
      tickAgeMs = Math.max(0, Date.now() - tickTimeMs);
    } else {
      tickAgeMs = null;
    }
    const tickFresh = tickAgeMs !== null && tickAgeMs <= FRESHNESS_THRESHOLD_MS;
    const hbState = heartbeat.state || "STALE";
    const heartbeatFresh = hbState === "HEALTHY";

    // 4) Reconciliation: bridge data vs /verification (single source of truth on bridge side)
    const reconciliation = {
      tick_match: verification.tick === true && tickJ.available === true,
      account_match: verification.account === true && acc.ok && (acc.json ? acc.json.connected : false) !== false,
      positions_match: verification.positions === true,
      heartbeat_match: verification.heartbeat === true && heartbeatFresh,
    };

    const snapshot = {
      symbol: SYMBOL,
      bid: tickJ.bid ?? null, ask: tickJ.ask ?? null, last: tickJ.last ?? null,
      tick_time: tickTimeMs || null,
      spread: (tickJ.ask != null && tickJ.bid != null) ? tickJ.ask - tickJ.bid : null,
      tick_age_ms: tickAgeMs, tick_fresh: tickFresh,
      balance: account.balance ?? null, equity: account.equity ?? null,
      margin: account.margin ?? null, free_margin: account.free_margin ?? null,
      currency: account.currency || null, account_fresh: acc.ok,
      positions: positions.map(p => ({ ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume, entry: p.entry, sl: p.sl, tp: p.tp, profit: p.profit })),
      positions_count: positions.length, positions_fresh: pos.ok,
      orders_count: orders.length,
      heartbeat_state: hbState, heartbeat_fresh: heartbeatFresh,
      server_time_ms: serverTimeMs,
      ingestion_latency_ms: Date.now() - tStart,
      bridge_tier: verification.tier || "BACKEND_CONNECTED",
      live_execution_blocked: verification.live_execution_blocked ?? true,
      latencies, reconciliation, reachable: true, error: null, fetched_at: now,
    };

    // 5) Persist snapshot (service role) for audit/reconciliation history
    try { await base44.asServiceRole.entities.MT5DataSnapshot.create(snapshot); } catch (_) {}

    // 6) Log mismatches — no auto-correction, just the record
    const mismatches = [];
    if (!reconciliation.tick_match) mismatches.push({ field: "tick", bridge_value: String(tickJ.available), quantpilot_value: String(verification.tick), severity: "CRITICAL" });
    if (!reconciliation.account_match) mismatches.push({ field: "account", bridge_value: String(acc.ok), quantpilot_value: String(verification.account), severity: "CRITICAL" });
    if (!reconciliation.positions_match) mismatches.push({ field: "positions", bridge_value: String(positions.length), quantpilot_value: String(verification.positions), severity: "WARNING" });
    if (!reconciliation.heartbeat_match) mismatches.push({ field: "heartbeat", bridge_value: hbState, quantpilot_value: String(verification.heartbeat), severity: "CRITICAL" });
    for (const m of mismatches) {
      try { await base44.asServiceRole.entities.DataMismatch.create({ source: "MT5_RECONCILIATION", timestamp: now, dashboard_value: null, ...m }); } catch (_) {}
    }

    return Response.json(snapshot);
  } catch (error) {
    return Response.json({ error: error.message, reachable: false, bridge_tier: "UI_CONTRACT", live_execution_blocked: true, fetched_at: new Date().toISOString() }, { status: 500 });
  }
}