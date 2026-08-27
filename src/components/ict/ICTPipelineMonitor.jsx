import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { Activity, Radar, ShieldCheck, RefreshCw, Play, Pause, Clock, Gauge } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import { analyzeICT, generatePaperSignal, getCurrentSession, checkSignalFreshness, SIGNAL_FRESHNESS_THRESHOLD_MS } from "@/lib/ictEngine";
import { createICTPerformanceWindow, pushICTSample, computeICTMetrics, formatDuration } from "@/lib/ictPerformanceMonitor";

const POLL_MS = 5000;

function fmtMs(v) {
  if (v == null || Number.isNaN(v)) return "–";
  if (v < 1000) return `${Math.round(v)} ms`;
  return `${(v / 1000).toFixed(2)} s`;
}
function fmtNum(v, d = 2) {
  if (v == null || Number.isNaN(v)) return "–";
  return Number(v).toFixed(d);
}
function fmtPrice(v) {
  if (v == null || Number.isNaN(v)) return "–";
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** @param {{label: any, value: any, tone?: string, hint?: string}} props */
const Metric = memo(function Metric({ label, value, tone = "default", hint }) {
  const toneClass = { default: "text-foreground", fresh: "text-profit", stale: "text-loss", warn: "text-warning", cyan: "text-primary" }[tone];
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono-num text-sm font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
    </div>
  );
});

/** @param {{label: string, passed: boolean}} props */
const GateRow = memo(function GateRow({ label, passed }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-bold ${passed ? "text-profit" : "text-loss"}`}>{passed ? "PASS" : "FAIL"}</span>
    </div>
  );
});

/** @param {{label: string, state: string}} props */
const SafetyGate = memo(function SafetyGate({ label, state }) {
  const isBlocked = state === "BLOCKED" || state === "OFF";
  const isAllowed = state === "ALLOWED" || state === "TRUE" || state === "ENABLED";
  return (
    <div className={`rounded-md border px-2 py-1.5 text-center ${isBlocked ? "border-loss/30 bg-loss/10" : isAllowed ? "border-profit/30 bg-profit/10" : "border-border bg-secondary/30"}`}>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-xs font-bold ${isBlocked ? "text-loss" : "text-profit"}`}>{state}</div>
    </div>
  );
});

/** @param {{verdict: string}} props */
const VerdictBadge = memo(function VerdictBadge({ verdict }) {
  const config = {
    PERFORMANCE_PASS: { color: "profit", label: "PERFORMANCE_PASS" },
    PERFORMANCE_WARNING: { color: "warning", label: "PERFORMANCE_WARNING" },
    PERFORMANCE_FAIL: { color: "loss", label: "PERFORMANCE_FAIL" },
    PENDING: { color: "muted", label: "PENDING" },
  }[verdict] || { color: "muted", label: verdict };
  return <StatusBadge status={config.label} color={config.color} />;
});

const DECISION_COLORS = {
  NO_TRADE: "loss", WATCH: "warning", SETUP: "cyan", VALIDATED_SETUP: "profit",
};

export default function ICTPipelineMonitor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [perfMetrics, setPerfMetrics] = useState(() => computeICTMetrics(createICTPerformanceWindow()));
  const invokeStartRef = useRef(0);
  const windowRef = useRef(createICTPerformanceWindow());

  const poll = useCallback(async () => {
    invokeStartRef.current = performance.now();
    let snap;
    try {
      const res = await base44.functions.invoke("fetchICTPipelineSnapshot", {});
      snap = res?.data ?? res;
      setData(snap);
      setError(snap?.reachable === false ? snap?.error || "bridge unreachable" : null);
    } catch (e) {
      setError(e?.message || "invoke failed");
      snap = null;
    }
    setLastFetch(new Date().toISOString());

    // Run ICT engine on candles
    let ictResult = null;
    let ictLong = null, ictShort = null;
    if (snap?.candles && snap.candles.length >= 10) {
      try {
        ictLong = analyzeICT(snap.candles, "LONG");
        ictShort = analyzeICT(snap.candles, "SHORT");
        ictResult = ictLong; // use LONG for primary metrics
      } catch (e) {
        ictResult = { engine_error: true };
      }
    }

    // Signal freshness
    const sigFresh = ictResult?.signal_freshness
      ? checkSignalFreshness(
          ictResult.signal_freshness.signal_created_at,
          ictResult.signal_freshness.market_data_timestamp,
          ictResult.signal_freshness.structure_version,
          windowRef.current.previous_structure_version,
        )
      : null;

    const dashboardLatencyMs = performance.now() - invokeStartRef.current;

    // Push sample to rolling window
    pushICTSample(windowRef.current, {
      tick_age_ms: snap?.tick_age_ms ?? null,
      tick_fresh: snap?.tick_fresh === true,
      tick_dropped: !snap || snap.reachable === false,
      bridge_latency_ms: snap?.latencies?.tick_ms ?? null,
      rates_latency_ms: snap?.latencies?.rates_ms ?? null,
      ingestion_latency_ms: snap?.ingestion_latency_ms ?? null,
      dashboard_latency_ms: dashboardLatencyMs,
      heartbeat_healthy: snap?.heartbeat_state === "HEALTHY",
      account_sync: snap?.account_fresh === true,
      position_sync: snap?.positions_fresh === true,
      reconciliation_all_match: snap?.reachable === true && !snap?.error,
      error: !snap || snap.reachable === false || !!snap?.error,
      ict_structure_ms: ictResult?.latencies?.structure_ms ?? null,
      ict_liquidity_ms: ictResult?.latencies?.liquidity_ms ?? null,
      ict_fvg_ob_ms: ictResult?.latencies?.fvg_ob_ms ?? null,
      ict_signal_ms: ictResult?.latencies?.signal_ms ?? null,
      ict_total_ms: ictResult?.latencies?.total_ms ?? null,
      ict_decision: ictResult?.decision || "NO_TRADE",
      ict_signal_fresh: sigFresh?.signal_fresh ?? false,
      ict_signal_age_ms: sigFresh?.signal_age_ms ?? null,
      ict_structure_version: ictResult?.signal_freshness?.structure_version ?? null,
      ict_engine_error: ictResult?.engine_error === true,
    });
    setPerfMetrics(computeICTMetrics(windowRef.current));
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [running, poll]);

  const ictAnalysis = useMemo(() => {
    if (!data?.candles || data.candles.length < 10) return null;
    try {
      const longAnalysis = analyzeICT(data.candles, "LONG");
      const shortAnalysis = analyzeICT(data.candles, "SHORT");
      const session = getCurrentSession();
      const longSignal = generatePaperSignal(longAnalysis, { bid: data.bid });
      const shortSignal = generatePaperSignal(shortAnalysis, { bid: data.bid });
      return { longAnalysis, shortAnalysis, longSignal, shortSignal, session };
    } catch (e) {
      return { engine_error: true };
    }
  }, [data]);

  const reachable = data?.reachable === true;
  const ratesOk = data?.rates_available === true;
  const tickFresh = data?.tick_fresh === true;
  const candleComplete = data?.candle_complete === true;
  const hbHealthy = data?.heartbeat_state === "HEALTHY";

  const sigFresh = ictAnalysis?.longAnalysis?.signal_freshness
    ? checkSignalFreshness(
        ictAnalysis.longAnalysis.signal_freshness.signal_created_at,
        ictAnalysis.longAnalysis.signal_freshness.market_data_timestamp,
        ictAnalysis.longAnalysis.signal_freshness.structure_version,
        windowRef.current.previous_structure_version,
      )
    : null;

  return (
    <PanelCard
      title="ICT PIPELINE — PHASE ICT-XAUUSD-RO"
      action={
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={perfMetrics.verdict} />
          <StatusBadge status={!reachable ? "OFFLINE" : !ratesOk ? "NO_RATES" : !tickFresh ? "STALE" : "LIVE"}
            color={!reachable ? "loss" : !ratesOk ? "warning" : !tickFresh ? "warning" : "profit"} />
          <button onClick={() => setRunning(r => !r)} className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-muted">
            {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <button onClick={poll} className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-muted">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      }
    >
      {/* Safety Gates */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-profit" />
          Sicherheitsgatter (hard, unveränderlich)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <SafetyGate label="MT5_E2E" state="TRUE" />
          <SafetyGate label="READ_ONLY" state="TRUE" />
          <SafetyGate label="ICT_ANALYSIS" state="ENABLED" />
          <SafetyGate label="PAPER_EXEC" state="OFF" />
          <SafetyGate label="ORDER_CHECK" state="ALLOWED" />
          <SafetyGate label="ORDER_SEND" state="BLOCKED" />
          <SafetyGate label="LIVE_EXEC" state="BLOCKED" />
        </div>
      </div>

      {/* Test Duration + Verdict */}
      <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">Test-Dauer:</span>
          <span className="font-mono text-sm font-bold text-foreground">{formatDuration(perfMetrics.duration_ms)}</span>
          <span className="text-xs text-muted-foreground">· {perfMetrics.samples} Samples</span>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">Verdict:</span>
          <VerdictBadge verdict={perfMetrics.verdict} />
        </div>
      </div>

      {error && <div className="mb-3 rounded-md border border-loss/30 bg-loss/10 px-3 py-1.5 text-xs text-loss">{error}</div>}

      {/* Pipeline Latencies */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" /> Pipeline-Latenzen
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="health_ms" value={fmtMs(data?.latencies?.health_ms)} tone="cyan" />
          <Metric label="tick_ms" value={fmtMs(data?.latencies?.tick_ms)} tone="cyan" />
          <Metric label="rates_ms" value={fmtMs(data?.latencies?.rates_ms)} tone={ratesOk ? "cyan" : "stale"} />
          <Metric label="account_ms" value={fmtMs(data?.latencies?.account_ms)} tone="cyan" />
          <Metric label="positions_ms" value={fmtMs(data?.latencies?.positions_ms)} tone="cyan" />
          <Metric label="heartbeat_ms" value={fmtMs(data?.latencies?.heartbeat_ms)} tone="cyan" />
          <Metric label="ingestion_ms" value={fmtMs(data?.ingestion_latency_ms)} tone="cyan" hint="Bridge → QuantPilot" />
          <Metric label="ict_compute" value={fmtMs(ictAnalysis?.longAnalysis?.latencies?.total_ms)} tone="cyan" hint="Frontend ICT Engine" />
          <Metric label="dashboard_ms" value={fmtMs(perfMetrics.dashboard_latency_p50)} tone="cyan" hint="p50 invoke→render" />
          <Metric label="total_pipeline" value={fmtMs((data?.ingestion_latency_ms ?? 0) + (ictAnalysis?.longAnalysis?.latencies?.total_ms ?? 0))} tone="fresh" hint="MT5 → Dashboard" />
        </div>
      </div>

      {/* ICT Engine Per-Stage Latencies */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Radar className="h-3.5 w-3.5 text-primary" /> ICT Engine Stufen-Latenzen
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="ICT_TICK_LATENCY" value={fmtMs(data?.tick_age_ms)} tone={tickFresh ? "fresh" : "stale"} />
          <Metric label="ICT_CANDLE_LATENCY" value={fmtMs(data?.last_candle_age_ms)} tone={data?.last_candle_age_ms != null && data.last_candle_age_ms < 120000 ? "fresh" : "warn"} />
          <Metric label="ICT_STRUCTURE_LAT" value={fmtMs(ictAnalysis?.longAnalysis?.latencies?.structure_ms)} tone="cyan" hint="M1 Structure + BOS" />
          <Metric label="ICT_LIQUIDITY_LAT" value={fmtMs(ictAnalysis?.longAnalysis?.latencies?.liquidity_ms)} tone="cyan" hint="Sweep / Raid" />
          <Metric label="ICT_SIGNAL_LAT" value={fmtMs(ictAnalysis?.longAnalysis?.latencies?.signal_ms)} tone="cyan" hint="Score + Decision" />
        </div>
      </div>

      {/* ICT Performance Counters (Rolling Window) */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Gauge className="h-3.5 w-3.5 text-primary" /> ICT Performance-Metriken (Rolling Window)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="ICT_SIGNALS_TOTAL" value={perfMetrics.ict_signals_total ?? 0} tone="cyan" />
          <Metric label="ICT_VALIDATED_SETUPS" value={perfMetrics.ict_validated_setups ?? 0} tone="fresh" />
          <Metric label="ICT_SETUPS" value={perfMetrics.ict_setups ?? 0} tone="cyan" />
          <Metric label="ICT_STALE_SIGNALS" value={perfMetrics.ict_stale_signal_count ?? 0} tone={(perfMetrics.ict_stale_signal_count ?? 0) > 0 ? "stale" : "fresh"} />
          <Metric label="ICT_RECALCULATIONS" value={perfMetrics.ict_recalculations ?? 0} tone={(perfMetrics.ict_recalculations ?? 0) > 0 ? "warn" : "fresh"} />
          <Metric label="ICT_ENGINE_ERRORS" value={perfMetrics.ict_engine_errors ?? 0} tone={(perfMetrics.ict_engine_errors ?? 0) > 0 ? "stale" : "fresh"} />
        </div>
      </div>

      {/* Performance Targets (Rolling Window) */}
      <div className="mb-3">
        <div className="mb-2 text-xs font-semibold text-foreground">Performance-Ziele (Rolling Window p95)</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="tick_freshness" value={fmtMs(perfMetrics.tick_age_p95)} hint="Ziel < 3s" tone={perfMetrics.tick_age_p95 != null && perfMetrics.tick_age_p95 <= 3000 ? "fresh" : "stale"} />
          <Metric label="tick_drops" value={perfMetrics.tick_drops ?? 0} hint="Ziel 0" tone={perfMetrics.tick_drops === 0 ? "fresh" : "stale"} />
          <Metric label="bridge_latency" value={fmtMs(perfMetrics.bridge_latency_p95)} hint="Ziel < 500ms" tone={perfMetrics.bridge_latency_p95 != null && perfMetrics.bridge_latency_p95 <= 500 ? "fresh" : "stale"} />
          <Metric label="ingestion" value={fmtMs(perfMetrics.ingestion_p95)} hint="Ziel < 1s" tone={perfMetrics.ingestion_p95 != null && perfMetrics.ingestion_p95 <= 1000 ? "fresh" : "stale"} />
          <Metric label="dashboard_lat" value={fmtMs(perfMetrics.dashboard_latency_p95)} hint="Ziel < 2s" tone={perfMetrics.dashboard_latency_p95 != null && perfMetrics.dashboard_latency_p95 <= 2000 ? "fresh" : "stale"} />
          <Metric label="heartbeat_healthy" value={`${fmtNum(perfMetrics.heartbeat_healthy_rate, 1)}%`} hint="Ziel ≥ 99%" tone={perfMetrics.heartbeat_healthy_rate >= 99 ? "fresh" : "stale"} />
          <Metric label="account_sync" value={`${fmtNum(perfMetrics.account_sync_rate, 1)}%`} hint="Ziel 100%" tone={perfMetrics.account_sync_rate >= 100 ? "fresh" : "stale"} />
          <Metric label="position_sync" value={`${fmtNum(perfMetrics.position_sync_rate, 1)}%`} hint="Ziel 100%" tone={perfMetrics.position_sync_rate >= 100 ? "fresh" : "stale"} />
          <Metric label="reconciliation" value={`${fmtNum(perfMetrics.reconciliation_rate, 1)}%`} hint="Ziel ALL MATCH" tone={perfMetrics.reconciliation_rate >= 100 ? "fresh" : "stale"} />
          <Metric label="error_rate" value={`${fmtNum(perfMetrics.error_rate, 1)}%`} hint="Ziel 0%" tone={perfMetrics.error_rate === 0 ? "fresh" : "stale"} />
        </div>
      </div>

      {/* Signal Freshness */}
      {sigFresh && (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" /> Signal-Freshness
            <StatusBadge status={sigFresh.signal_status} color={sigFresh.signal_fresh ? "profit" : "loss"} />
            <StatusBadge status={`EXEC: ${sigFresh.execution}`} color={sigFresh.signal_fresh ? "profit" : "loss"} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="signal_created_at" value={sigFresh.signal_created_at ? new Date(sigFresh.signal_created_at).toLocaleTimeString("de-DE") : "–"} />
            <Metric label="market_data_ts" value={sigFresh.market_data_timestamp ? new Date(sigFresh.market_data_timestamp).toLocaleTimeString("de-DE") : "–"} />
            <Metric label="signal_age_ms" value={fmtMs(sigFresh.signal_age_ms)} tone={sigFresh.signal_fresh ? "fresh" : "stale"} />
            <Metric label="signal_fresh" value={sigFresh.signal_fresh ? "TRUE" : "FALSE"} tone={sigFresh.signal_fresh ? "fresh" : "stale"} />
            <Metric label="structure_version" value={sigFresh.structure_version ? sigFresh.structure_version.substring(0, 20) + "..." : "–"} hint={sigFresh.structure_changed ? "CHANGED" : "stable"} />
          </div>
        </div>
      )}

      {/* Tick & Market Data */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Radar className="h-3.5 w-3.5 text-primary" /> Tick & Market Data — XAUUSD
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="bid" value={fmtPrice(data?.bid)} tone="cyan" />
          <Metric label="ask" value={fmtPrice(data?.ask)} tone="cyan" />
          <Metric label="spread" value={fmtNum(data?.spread, 3)} tone="cyan" />
          <Metric label="tick_age_ms" value={fmtMs(data?.tick_age_ms)} tone={tickFresh ? "fresh" : "stale"} />
          <Metric label="tick_fresh" value={tickFresh ? "TRUE" : "FALSE"} tone={tickFresh ? "fresh" : "stale"} />
          <Metric label="server_time_ms" value={data?.server_time_ms ?? "–"} hint="Bridge-Host" />
        </div>
      </div>

      {/* M1 Candle + Account + Heartbeat */}
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div>
          <div className="mb-2 text-xs font-semibold text-foreground">M1 Candle</div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="count" value={data?.candle_count ?? 0} tone="cyan" />
            <Metric label="gaps" value={data?.candle_gaps ?? 0} tone={(data?.candle_gaps ?? 0) > 0 ? "stale" : "fresh"} />
            <Metric label="last_age" value={fmtMs(data?.last_candle_age_ms)} tone={data?.last_candle_age_ms != null && data.last_candle_age_ms < 120000 ? "fresh" : "warn"} />
            <Metric label="complete" value={candleComplete ? "TRUE" : "FALSE"} tone={candleComplete ? "fresh" : "stale"} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-foreground">Account & Positionen</div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="equity" value={fmtNum(data?.equity)} tone="cyan" />
            <Metric label="free_margin" value={fmtNum(data?.free_margin)} tone="cyan" />
            <Metric label="balance" value={fmtNum(data?.balance)} tone="cyan" />
            <Metric label="positions" value={data?.positions_count ?? 0} tone={(data?.positions_count ?? 0) > 0 ? "warn" : "fresh"} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-foreground">Heartbeat</div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="state" value={data?.heartbeat_state ?? "–"} tone={hbHealthy ? "fresh" : "stale"} />
            <Metric label="age_s" value={fmtNum(data?.heartbeat_age_s, 1)} tone={hbHealthy ? "fresh" : "stale"} />
            <Metric label="post_success" value={data?.heartbeat_post_success ?? 0} tone="fresh" />
            <Metric label="failures" value={data?.heartbeat_post_failures ?? 0} tone={(data?.heartbeat_post_failures ?? 0) > 0 ? "stale" : "fresh"} />
          </div>
        </div>
      </div>

      {/* ICT Analysis */}
      {ictAnalysis && !ictAnalysis.engine_error ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Radar className="h-3.5 w-3.5 text-primary" /> ICT Engine — Real M1 Candles
            <StatusBadge status={ictAnalysis.session?.name || "OFF"} color={ictAnalysis.session?.name === "LONDON" || ictAnalysis.session?.name === "NEW_YORK" ? "profit" : "muted"} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ICTSideResult label="LONG" analysis={ictAnalysis.longAnalysis} signal={ictAnalysis.longSignal} />
            <ICTSideResult label="SHORT" analysis={ictAnalysis.shortAnalysis} signal={ictAnalysis.shortSignal} />
          </div>
        </div>
      ) : (
        <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {ratesOk ? "Zu wenige Candles für ICT-Analyse (<10)" : "Rates-Endpunkt nicht verfügbar — Bridge braucht /symbols/{symbol}/rates"}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Quelle: <span className="font-mono">fetchICTPipelineSnapshot</span> alle {POLL_MS / 1000}s ·
        ICT-Engine auf echten M1-Candles · Rolling Window {formatDuration(perfMetrics.duration_ms)} ·
        Signal-Freshness-Schwelle {SIGNAL_FRESHNESS_THRESHOLD_MS / 1000}s · Keine Order, kein Live-Execution.
      </p>
    </PanelCard>
  );
}

/** @param {{label: string, analysis: any, signal: any}} props */
const ICTSideResult = memo(function ICTSideResult({ label, analysis, signal }) {
  if (!analysis || !analysis.components) {
    return (
      <div className="rounded-md border border-border bg-secondary/30 p-3">
        <div className="mb-2 font-mono text-xs font-bold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">Keine Analyse</div>
      </div>
    );
  }
  const { bos, sweep, fvg, ob, premiumDiscount, session } = analysis.components;
  const decision = analysis.decision || analysis.setup;
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-foreground">{label}</span>
        <StatusBadge status={decision} color={DECISION_COLORS[decision] || "muted"} />
      </div>
      <div className="space-y-1">
        <GateRow label="Liquidity Sweep" passed={sweep?.sweep === true} />
        <GateRow label="Displacement (BOS)" passed={bos?.mss_bos !== "NONE"} />
        <GateRow label="FVG detected" passed={fvg?.detected === true} />
        <GateRow label="Order Block" passed={ob?.detected === true} />
        <GateRow label="Side aligned" passed={
          label === "LONG"
            ? bos?.direction === "BULLISH" && premiumDiscount?.zone === "DISCOUNT"
            : bos?.direction === "BEARISH" && premiumDiscount?.zone === "PREMIUM"
        } />
        <GateRow label="Killzone" passed={session?.name === "LONDON" || session?.name === "NEW_YORK"} />
      </div>
      {signal && (
        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-border pt-2">
          <div className="text-center">
            <div className="text-[9px] text-muted-foreground">Entry</div>
            <div className="font-mono text-[11px] text-foreground">{signal.entry?.toFixed(2) ?? "–"}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-muted-foreground">SL</div>
            <div className="font-mono text-[11px] text-loss">{signal.stop_loss?.toFixed(2) ?? "–"}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-muted-foreground">RR</div>
            <div className="font-mono text-[11px] text-primary">{signal.rr ?? "–"}</div>
          </div>
        </div>
      )}
    </div>
  );
});