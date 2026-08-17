// QuantPilot – Tick Monitor aggregation (XAUUSD)
// Rolling window over fetchMT5Snapshot samples. Pure functions, no side effects,
// so the component stays thin and the math is testable in isolation.

export const TICK_MONITOR_WINDOW_SIZE = 60;

export function createTickWindow(maxSize = TICK_MONITOR_WINDOW_SIZE) {
  return { samples: [], maxSize };
}

export function pushSample(window, sample) {
  window.samples.push(sample);
  if (window.samples.length > window.maxSize) window.samples.shift();
  return window;
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function computeMetrics(window) {
  const s = window.samples;
  const received = s.length;
  if (received === 0) {
    return {
      ticks_received: 0,
      ticks_fresh: 0,
      ticks_stale: 0,
      min_age_ms: null,
      avg_age_ms: null,
      p95_age_ms: null,
      max_age_ms: null,
      server_time_delta: null,
      bridge_latency_ms: null,
      quantpilot_ingestion_latency_ms: null,
      dashboard_update_latency_ms: null,
      dropped_ticks: 0,
      heartbeat_stability_pct: null,
      account_sync_pct: null,
      position_sync_pct: null,
      error_rate_pct: null,
    };
  }

  const ages = s.map((x) => x.tick_age_ms).filter((a) => typeof a === "number" && a >= 0);
  const sorted = [...ages].sort((a, b) => a - b);
  const fresh = s.filter((x) => x.tick_fresh).length;
  const dropped = s.filter((x) => x.dropped).length;
  const errored = s.filter((x) => x.errored).length;
  const hbHealthy = s.filter((x) => x.heartbeat_healthy).length;
  const accOk = s.filter((x) => x.account_fresh).length;
  const posOk = s.filter((x) => x.positions_fresh).length;
  const pct = (n) => Math.round((n / received) * 100);

  return {
    ticks_received: received,
    ticks_fresh: fresh,
    ticks_stale: received - fresh,
    min_age_ms: sorted.length ? sorted[0] : null,
    avg_age_ms: avg(ages),
    p95_age_ms: percentile(sorted, 95),
    max_age_ms: sorted.length ? sorted[sorted.length - 1] : null,
    server_time_delta: avg(s.map((x) => x.server_time_delta).filter((a) => typeof a === "number")),
    bridge_latency_ms: avg(s.map((x) => x.bridge_latency_ms).filter((a) => typeof a === "number")),
    quantpilot_ingestion_latency_ms: avg(s.map((x) => x.ingestion_latency_ms).filter((a) => typeof a === "number")),
    dashboard_update_latency_ms: avg(s.map((x) => x.dashboard_update_latency_ms).filter((a) => typeof a === "number")),
    dropped_ticks: dropped,
    heartbeat_stability_pct: pct(hbHealthy),
    account_sync_pct: pct(accOk),
    position_sync_pct: pct(posOk),
    error_rate_pct: pct(errored),
  };
}