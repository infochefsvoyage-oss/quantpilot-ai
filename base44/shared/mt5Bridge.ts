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

// ─── Candle History Batch Fetcher ───────────────────────────────────────
// Fetches multiple batches via start-pagination (start=0, 5000, 10000, ...),
// deduplicates by candle time, and merges chronologically (oldest → newest).
// Read-only: no orders, no execution.

const TF_SECONDS = {
  M1: 60, M2: 120, M3: 180, M4: 240, M5: 300, M6: 360,
  M10: 600, M12: 720, M15: 900, M20: 1200, M30: 1800,
  H1: 3600, H2: 7200, H3: 10800, H4: 14400, H6: 21600, H8: 28800, H12: 43200,
  D1: 86400, W1: 604800, MN1: 2592000,
};

export async function fetchCandleHistory(base, headers, symbol, timeframe = "M1", totalCount = 20000, batchSize = 5000) {
  const cleanBase = base.replace(/\/+$/, "");
  const batches = Math.ceil(totalCount / batchSize);
  const expectedStep = TF_SECONDS[timeframe] || 60;

  // Fetch all batches in parallel
  const results = await Promise.all(
    Array.from({ length: batches }, (_, i) => {
      const start = i * batchSize;
      const count = Math.min(batchSize, totalCount - start);
      return fetchJson(
        `${cleanBase}/symbols/${symbol}/rates?timeframe=${timeframe}&count=${count}&start=${start}`,
        headers, 60000
      );
    })
  );

  // Collect candles + batch metadata
  const allCandles = [];
  const batchInfo = [];
  results.forEach((r, i) => {
    const rates = r.ok ? (r.json?.rates || r.json?.candles || []) : [];
    allCandles.push(...rates);
    batchInfo.push({
      batch: i,
      start: i * batchSize,
      count: rates.length,
      ok: r.ok,
      status: r.status,
      first_time: rates[0]?.time || null,
      last_time: rates[rates.length - 1]?.time || null,
    });
  });

  // Deduplicate by candle time (keep first occurrence)
  const seen = new Set();
  const deduped = [];
  let duplicates = 0;
  for (const c of allCandles) {
    if (seen.has(c.time)) { duplicates++; continue; }
    seen.add(c.time);
    deduped.push(c);
  }

  // Sort chronologically: oldest → newest
  deduped.sort((a, b) => a.time - b.time);

  // Detect gaps between consecutive candles
  const gaps = [];
  for (let i = 1; i < deduped.length; i++) {
    const dt = deduped[i].time - deduped[i - 1].time;
    if (dt !== expectedStep) {
      gaps.push({ idx: i, expected: expectedStep, actual: dt, gap_units: dt / expectedStep });
    }
  }

  return {
    symbol,
    timeframe,
    candles: deduped,
    total_count: deduped.length,
    batches_fetched: batches,
    duplicates_removed: duplicates,
    first_time: deduped[0]?.time || null,
    first_iso: deduped[0]?.time ? new Date(deduped[0].time * 1000).toISOString() : null,
    last_time: deduped[deduped.length - 1]?.time || null,
    last_iso: deduped[deduped.length - 1]?.time ? new Date(deduped[deduped.length - 1].time * 1000).toISOString() : null,
    gaps,
    gap_count: gaps.length,
    batch_info: batchInfo,
  };
}