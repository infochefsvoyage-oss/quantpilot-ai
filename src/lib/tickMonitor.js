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
      p50_age_ms: null,
      p99_age_ms: null,
      p50_bridge_latency_ms: null,
      p95_bridge_latency_ms: null,
      p50_ingestion_latency_ms: null,
      p95_ingestion_latency_ms: null,
      p50_dashboard_latency_ms: null,
      p95_dashboard_latency_ms: null,
      heartbeat_reasons: { HEARTBEAT_HEALTHY: 0, EA_NOT_RUNNING: 0, EA_HEARTBEAT_NOT_RECEIVED: 0, HEARTBEAT_STALE: 0 },
      heartbeat_reason_last: null,
      heartbeat_age_s_last: null,
    };
  }

  const ages = s.map((x) => x.tick_age_ms).filter((a) => typeof a === "number" && a >= 0);
  const sorted = [...ages].sort((a, b) => a - b);
  const bridgeLats = s.map((x) => x.bridge_latency_ms).filter((a) => typeof a === "number").sort((a, b) => a - b);
  const ingLats = s.map((x) => x.ingestion_latency_ms).filter((a) => typeof a === "number").sort((a, b) => a - b);
  const dashLats = s.map((x) => x.dashboard_update_latency_ms).filter((a) => typeof a === "number").sort((a, b) => a - b);
  const fresh = s.filter((x) => x.tick_fresh).length;
  const dropped = s.filter((x) => x.dropped).length;
  const errored = s.filter((x) => x.errored).length;
  const hbHealthy = s.filter((x) => x.heartbeat_healthy).length;
  const accOk = s.filter((x) => x.account_fresh).length;
  const posOk = s.filter((x) => x.positions_fresh).length;
  const pct = (n) => Math.round((n / received) * 100);

  const reasons = { HEARTBEAT_HEALTHY: 0, EA_NOT_RUNNING: 0, EA_HEARTBEAT_NOT_RECEIVED: 0, HEARTBEAT_STALE: 0 };
  for (const x of s) {
    const r = x.heartbeat_reason || (x.heartbeat_healthy ? "HEARTBEAT_HEALTHY" : "EA_NOT_RUNNING");
    if (r in reasons) reasons[r] += 1;
  }
  const lastSample = s[s.length - 1];

  return {
    ticks_received: received,
    ticks_fresh: fresh,
    ticks_stale: received - fresh,
    min_age_ms: sorted.length ? sorted[0] : null,
    avg_age_ms: avg(ages),
    p50_age_ms: percentile(sorted, 50),
    p95_age_ms: percentile(sorted, 95),
    p99_age_ms: percentile(sorted, 99),
    max_age_ms: sorted.length ? sorted[sorted.length - 1] : null,
    server_time_delta: avg(s.map((x) => x.server_time_delta).filter((a) => typeof a === "number")),
    bridge_latency_ms: avg(bridgeLats),
    p50_bridge_latency_ms: percentile(bridgeLats, 50),
    p95_bridge_latency_ms: percentile(bridgeLats, 95),
    quantpilot_ingestion_latency_ms: avg(ingLats),
    p50_ingestion_latency_ms: percentile(ingLats, 50),
    p95_ingestion_latency_ms: percentile(ingLats, 95),
    dashboard_update_latency_ms: avg(dashLats),
    p50_dashboard_latency_ms: percentile(dashLats, 50),
    p95_dashboard_latency_ms: percentile(dashLats, 95),
    dropped_ticks: dropped,
    heartbeat_stability_pct: pct(hbHealthy),
    account_sync_pct: pct(accOk),
    position_sync_pct: pct(posOk),
    error_rate_pct: pct(errored),
    heartbeat_reasons: reasons,
    heartbeat_reason_last: lastSample?.heartbeat_reason || null,
    heartbeat_age_s_last: typeof lastSample?.heartbeat_age_s === "number" ? lastSample.heartbeat_age_s : null,
  };
}