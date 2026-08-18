// Shared MT5 bridge utilities — imported by fetchMT5Snapshot and fetchICTPipelineSnapshot.
// Plain module: exports only, no Deno.serve.

export const SYMBOL = "XAUUSD";
export const FRESHNESS_THRESHOLD_MS = 5000;
export const M1_MS = 60000;

export async function fetchJson(url, headers, timeoutMs = 6000) {
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

// Tick freshness — primary basis is bridge server_time_ms (bridge host clock,
// same host as MT5 → no cross-host clock skew). Falls back to tick.time * 1000.
export function computeTickAgeMs(tickJ) {
  const tickTimeMs = tickJ.time ? tickJ.time * 1000 : null;
  const serverTimeMs = typeof tickJ.server_time_ms === "number" && tickJ.server_time_ms > 0
    ? tickJ.server_time_ms : null;
  if (serverTimeMs !== null) return Math.max(0, Date.now() - serverTimeMs);
  if (tickTimeMs !== null) return Math.max(0, Date.now() - tickTimeMs);
  return null;
}

export function getServerTimeMs(tickJ) {
  return typeof tickJ.server_time_ms === "number" && tickJ.server_time_ms > 0
    ? tickJ.server_time_ms : null;
}

export function mapPositions(positions) {
  return positions.map(p => ({
    ticket: p.ticket, symbol: p.symbol, side: p.side,
    volume: p.volume, entry: p.entry, profit: p.profit,
  }));
}

export function heartbeatFields(heartbeat) {
  return {
    heartbeat_state: heartbeat.state || "STALE",
    heartbeat_fresh: (heartbeat.state || "STALE") === "HEALTHY",
    heartbeat_reason: heartbeat.reason || (heartbeat.state === "HEALTHY" ? "HEARTBEAT_HEALTHY" : "EA_NOT_RUNNING"),
    heartbeat_age_s: typeof heartbeat.heartbeat_age_s === "number" ? heartbeat.heartbeat_age_s : null,
    heartbeat_post_success: typeof heartbeat.post_success === "number" ? heartbeat.post_success : 0,
    heartbeat_post_failures: typeof heartbeat.post_failures === "number" ? heartbeat.post_failures : 0,
    heartbeat_failure_rate: typeof heartbeat.failure_rate === "number" ? heartbeat.failure_rate : 0,
  };
}