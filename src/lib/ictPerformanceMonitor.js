// ICT Performance Monitor — Rolling Window für PHASE ICT-XAUUSD-RO
// Sammelt Echtzeit-Messwerte über 30+ Minuten und berechnet PERFORMANCE_PASS/WARNING/FAIL.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

const MAX_SAMPLES = 720; // 60 min bei 5s Poll

export function createICTPerformanceWindow() {
  return {
    samples: [],
    started_at: Date.now(),
    previous_structure_version: null,
  };
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function pushICTSample(window, sample) {
  // Detect structure recalculation
  const recalculation = window.previous_structure_version != null
    && sample.ict_structure_version != null
    && sample.ict_structure_version !== window.previous_structure_version;
  sample.ict_recalculation = recalculation;
  if (sample.ict_structure_version) {
    window.previous_structure_version = sample.ict_structure_version;
  }
  window.samples.push(sample);
  if (window.samples.length > MAX_SAMPLES) window.samples.shift();
}

export function computeICTMetrics(window) {
  const samples = window.samples;
  const count = samples.length;

  if (count === 0) {
    return { samples: 0, duration_ms: 0, verdict: "PENDING", checks: {} };
  }

  const durationMs = Date.now() - window.started_at;

  // Extract arrays
  const tickAges = samples.map(s => s.tick_age_ms).filter(v => v != null);
  const bridgeLat = samples.map(s => s.bridge_latency_ms).filter(v => v != null);
  const ingestion = samples.map(s => s.ingestion_latency_ms).filter(v => v != null);
  const dashboard = samples.map(s => s.dashboard_latency_ms).filter(v => v != null);
  const ictStructure = samples.map(s => s.ict_structure_ms).filter(v => v != null);
  const ictLiquidity = samples.map(s => s.ict_liquidity_ms).filter(v => v != null);
  const ictSignal = samples.map(s => s.ict_signal_ms).filter(v => v != null);
  const ictTotal = samples.map(s => s.ict_total_ms).filter(v => v != null);

  // Counters
  const tickDrops = samples.filter(s => s.tick_dropped).length;
  const tickFreshCount = samples.filter(s => s.tick_fresh).length;
  const hbHealthy = samples.filter(s => s.heartbeat_healthy).length;
  const accSync = samples.filter(s => s.account_sync).length;
  const posSync = samples.filter(s => s.position_sync).length;
  const reconMatch = samples.filter(s => s.reconciliation_all_match).length;
  const errors = samples.filter(s => s.error).length;

  // ICT counters
  const signalsTotal = samples.filter(s => s.ict_decision && s.ict_decision !== "NO_TRADE").length;
  const validatedSetups = samples.filter(s => s.ict_decision === "VALIDATED_SETUP").length;
  const setups = samples.filter(s => s.ict_decision === "SETUP").length;
  const staleSignals = samples.filter(s => s.ict_signal_fresh === false).length;
  const recalculations = samples.filter(s => s.ict_recalculation).length;
  const engineErrors = samples.filter(s => s.ict_engine_error).length;

  // Rates
  const tickFreshRate = (tickFreshCount / count) * 100;
  const hbHealthyRate = (hbHealthy / count) * 100;
  const accSyncRate = (accSync / count) * 100;
  const posSyncRate = (posSync / count) * 100;
  const reconRate = (reconMatch / count) * 100;
  const errorRate = (errors / count) * 100;
  const signalFreshRate = signalsTotal > 0 ? ((signalsTotal - staleSignals) / signalsTotal) * 100 : 100;

  // Verdict checks against targets
  const tickAgeP95 = percentile(tickAges, 95);
  const bridgeP95 = percentile(bridgeLat, 95);
  const ingestionP95 = percentile(ingestion, 95);
  const dashboardP95 = percentile(dashboard, 95);

  const checks = {
    tick_freshness: tickAgeP95 != null && tickAgeP95 <= 3000,
    tick_drops: tickDrops === 0,
    bridge_latency: bridgeP95 != null && bridgeP95 <= 500,
    ingestion: ingestionP95 != null && ingestionP95 <= 1000,
    dashboard_latency: dashboardP95 != null && dashboardP95 <= 2000,
    heartbeat_healthy: hbHealthyRate >= 99,
    account_sync: accSyncRate >= 100,
    position_sync: posSyncRate >= 100,
    reconciliation: reconRate >= 100,
    error_rate: errorRate === 0,
  };

  const allPass = Object.values(checks).every(c => c === true);
  const criticalFail = !checks.tick_drops || !checks.error_rate || !checks.reconciliation;

  let verdict;
  if (allPass) verdict = "PERFORMANCE_PASS";
  else if (criticalFail) verdict = "PERFORMANCE_FAIL";
  else verdict = "PERFORMANCE_WARNING";

  return {
    samples: count,
    duration_ms: durationMs,

    // Latencies p50/p95/max
    tick_age_p50: percentile(tickAges, 50),
    tick_age_p95: tickAgeP95,
    tick_age_max: tickAges.length > 0 ? Math.max(...tickAges) : null,

    bridge_latency_p50: percentile(bridgeLat, 50),
    bridge_latency_p95: bridgeP95,
    bridge_latency_max: bridgeLat.length > 0 ? Math.max(...bridgeLat) : null,

    ingestion_p50: percentile(ingestion, 50),
    ingestion_p95: ingestionP95,
    ingestion_max: ingestion.length > 0 ? Math.max(...ingestion) : null,

    dashboard_latency_p50: percentile(dashboard, 50),
    dashboard_latency_p95: dashboardP95,
    dashboard_latency_max: dashboard.length > 0 ? Math.max(...dashboard) : null,

    ict_structure_p50: percentile(ictStructure, 50),
    ict_structure_p95: percentile(ictStructure, 95),
    ict_liquidity_p50: percentile(ictLiquidity, 50),
    ict_liquidity_p95: percentile(ictLiquidity, 95),
    ict_signal_p50: percentile(ictSignal, 50),
    ict_signal_p95: percentile(ictSignal, 95),
    ict_total_p50: percentile(ictTotal, 50),
    ict_total_p95: percentile(ictTotal, 95),

    // Rates
    tick_fresh_rate: tickFreshRate,
    tick_drops: tickDrops,
    heartbeat_healthy_rate: hbHealthyRate,
    account_sync_rate: accSyncRate,
    position_sync_rate: posSyncRate,
    reconciliation_rate: reconRate,
    error_rate: errorRate,
    signal_fresh_rate: signalFreshRate,

    // ICT counters
    ict_signals_total: signalsTotal,
    ict_validated_setups: validatedSetups,
    ict_setups: setups,
    ict_stale_signal_count: staleSignals,
    ict_recalculations: recalculations,
    ict_engine_errors: engineErrors,

    // Verdict
    checks,
    verdict,
  };
}

export function formatDuration(ms) {
  if (!ms || ms < 1000) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}