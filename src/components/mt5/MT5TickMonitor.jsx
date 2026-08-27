import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { Activity, Play, Pause, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import MT5HeartbeatDiagnostic from "./MT5HeartbeatDiagnostic";
import { createTickWindow, pushSample, computeMetrics } from "@/lib/tickMonitor";

const POLL_MS = 3000;

function fmtMs(v) {
  if (v == null || Number.isNaN(v)) return "–";
  if (v < 1000) return `${Math.round(v)} ms`;
  return `${(v / 1000).toFixed(2)} s`;
}

function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return "–";
  return String(v);
}

/** @type {import('react').NamedExoticComponent<{label: any, value: any, hint?: string, tone?: string}>} */
const Metric = memo(function Metric({ label, value, hint = "", tone = "default" }) {
  const toneClass = {
    default: "text-foreground",
    fresh: "text-profit",
    stale: "text-loss",
    warn: "text-warning",
    cyan: "text-primary",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono-num text-lg font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
});

export default function MT5TickMonitor() {
  const [metrics, setMetrics] = useState(() => computeMetrics(createTickWindow()));
  const [running, setRunning] = useState(true);
  const [lastError, setLastError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [lastSnap, setLastSnap] = useState(null);
  const windowRef = useRef(createTickWindow());
  const invokeStartRef = useRef(0);

  const poll = useCallback(async () => {
    invokeStartRef.current = performance.now();
    let res;
    try {
      res = await base44.functions.invoke("fetchMT5Snapshot", {});
    } catch (e) {
      pushSample(windowRef.current, {
        tick_age_ms: null,
        tick_fresh: false,
        server_time_delta: null,
        bridge_latency_ms: null,
        ingestion_latency_ms: null,
        dashboard_update_latency_ms: performance.now() - invokeStartRef.current,
        dropped: true,
        errored: true,
        heartbeat_healthy: false,
        heartbeat_reason: "EA_HEARTBEAT_NOT_RECEIVED",
        heartbeat_age_s: null,
        account_fresh: false,
        positions_fresh: false,
        });
      setMetrics(computeMetrics(windowRef.current));
      setLastError(e?.message || "invoke failed");
      setLastFetch(new Date().toISOString());
      setLastSnap(null);
      return;
    }

    const renderMark = performance.now();
    const snap = res?.data ?? res;
    const serverTimeMs = typeof snap?.server_time_ms === "number" ? snap.server_time_ms : null;
    const now = Date.now();
    pushSample(windowRef.current, {
      tick_age_ms: typeof snap?.tick_age_ms === "number" ? snap.tick_age_ms : null,
      tick_fresh: !!snap?.tick_fresh,
      server_time_delta: serverTimeMs != null ? now - serverTimeMs : null,
      bridge_latency_ms: snap?.latencies?.tick_ms ?? null,
      ingestion_latency_ms: snap?.ingestion_latency_ms ?? null,
      dashboard_update_latency_ms: renderMark - invokeStartRef.current,
      dropped: !snap || snap.reachable === false,
      errored: !snap || snap.reachable === false,
      heartbeat_healthy: !!snap?.heartbeat_fresh,
      heartbeat_reason: snap?.heartbeat_reason || (!snap || snap.reachable === false ? "EA_HEARTBEAT_NOT_RECEIVED" : "EA_NOT_RUNNING"),
      heartbeat_age_s: typeof snap?.heartbeat_age_s === "number" ? snap.heartbeat_age_s : null,
      account_fresh: !!snap?.account_fresh,
      positions_fresh: !!snap?.positions_fresh,
    });
    setMetrics(computeMetrics(windowRef.current));
    setLastError(snap?.reachable === false ? snap?.error || "bridge unreachable" : null);
    setLastFetch(new Date().toISOString());
    setLastSnap(snap);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [running, poll]);

  const freshRate = metrics.ticks_received > 0
    ? Math.round((metrics.ticks_fresh / metrics.ticks_received) * 100)
    : 0;

  const postMetrics = useMemo(() => ({
    post_success: lastSnap?.heartbeat_post_success ?? 0,
    post_failures: lastSnap?.heartbeat_post_failures ?? 0,
    last_success_at: lastSnap?.heartbeat_last_success_at ?? null,
    last_failure_at: lastSnap?.heartbeat_last_failure_at ?? null,
    consecutive_failures: lastSnap?.heartbeat_consecutive_failures ?? 0,
    failure_rate: lastSnap?.heartbeat_failure_rate ?? 0,
  }), [lastSnap]);

  const diag = useMemo(() => ({
    reasons: metrics.heartbeat_reasons,
    currentReason: metrics.heartbeat_reason_last,
    heartbeatAgeS: metrics.heartbeat_age_s_last,
  }), [metrics.heartbeat_reasons, metrics.heartbeat_reason_last, metrics.heartbeat_age_s_last]);

  return (
    <PanelCard
      title="TICK_MONITOR — XAUUSD"
      action={
        <div className="flex items-center gap-2">
          <StatusBadge
            status={metrics.dropped_ticks > 0 ? "DEGRADED" : metrics.ticks_stale > 0 ? "PARTIAL" : "LIVE"}
            color={metrics.dropped_ticks > 0 ? "warning" : metrics.ticks_stale > 0 ? "warning" : "profit"}
          />
          <button
            onClick={() => setRunning((r) => !r)}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-muted"
          >
            {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={poll}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" />
            Now
          </button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5 text-primary" />
        Rolling Window: <span className="font-mono text-foreground">{metrics.ticks_received}</span> Samples
        · Fresh-Rate: <span className="font-mono text-profit">{freshRate}%</span>
        {lastFetch && (
          <span className="ml-auto font-mono text-[10px]">
            {new Date(lastFetch).toLocaleTimeString("de-DE")}
          </span>
        )}
      </div>

      {lastError && (
        <div className="mb-3 rounded-md border border-loss/30 bg-loss/10 px-3 py-1.5 text-xs text-loss">
          {lastError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="ticks_received" value={fmtNum(metrics.ticks_received)} />
        <Metric label="ticks_fresh" value={fmtNum(metrics.ticks_fresh)} tone="fresh" />
        <Metric label="ticks_stale" value={fmtNum(metrics.ticks_stale)} tone={metrics.ticks_stale > 0 ? "stale" : "default"} />
        <Metric label="dropped_ticks" value={fmtNum(metrics.dropped_ticks)} tone={metrics.dropped_ticks > 0 ? "stale" : "default"} />
        <Metric label="min_age_ms" value={fmtMs(metrics.min_age_ms)} tone="cyan" />
        <Metric label="avg_age_ms" value={fmtMs(metrics.avg_age_ms)} tone="cyan" />
        <Metric label="p50_age_ms" value={fmtMs(metrics.p50_age_ms)} tone="cyan" />
        <Metric label="p95_age_ms" value={fmtMs(metrics.p95_age_ms)} tone={metrics.p95_age_ms != null && metrics.p95_age_ms > 5000 ? "warn" : "cyan"} />
        <Metric label="p99_age_ms" value={fmtMs(metrics.p99_age_ms)} tone={metrics.p99_age_ms != null && metrics.p99_age_ms > 5000 ? "warn" : "cyan"} />
        <Metric label="max_age_ms" value={fmtMs(metrics.max_age_ms)} tone={metrics.max_age_ms != null && metrics.max_age_ms > 5000 ? "warn" : "cyan"} />
        <Metric label="server_time_delta" value={fmtMs(metrics.server_time_delta)} hint="now − server_time_ms" />
        <Metric label="bridge_latency_ms" value={fmtMs(metrics.bridge_latency_ms)} hint="avg /symbols tick" />
        <Metric label="p50_bridge_latency" value={fmtMs(metrics.p50_bridge_latency_ms)} tone="cyan" />
        <Metric label="p95_bridge_latency" value={fmtMs(metrics.p95_bridge_latency_ms)} tone={metrics.p95_bridge_latency_ms != null && metrics.p95_bridge_latency_ms > 1000 ? "warn" : "cyan"} />
        <Metric label="quantpilot_ingestion" value={fmtMs(metrics.quantpilot_ingestion_latency_ms)} hint="avg Base44 fn" />
        <Metric label="p50_ingestion" value={fmtMs(metrics.p50_ingestion_latency_ms)} tone="cyan" />
        <Metric label="p95_ingestion" value={fmtMs(metrics.p95_ingestion_latency_ms)} tone={metrics.p95_ingestion_latency_ms != null && metrics.p95_ingestion_latency_ms > 2000 ? "warn" : "cyan"} />
        <Metric label="dashboard_latency" value={fmtMs(metrics.dashboard_update_latency_ms)} hint="avg invoke → render" />
        <Metric label="p50_dashboard_latency" value={fmtMs(metrics.p50_dashboard_latency_ms)} tone="cyan" />
        <Metric label="p95_dashboard_latency" value={fmtMs(metrics.p95_dashboard_latency_ms)} tone={metrics.p95_dashboard_latency_ms != null && metrics.p95_dashboard_latency_ms > 3000 ? "warn" : "cyan"} />
        <Metric label="heartbeat_stability" value={`${fmtNum(metrics.heartbeat_stability_pct)}%`} tone={metrics.heartbeat_stability_pct === 100 ? "fresh" : metrics.heartbeat_stability_pct != null && metrics.heartbeat_stability_pct < 90 ? "stale" : "warn"} hint="HEALTHY / window" />
        <Metric label="account_sync" value={`${fmtNum(metrics.account_sync_pct)}%`} tone={metrics.account_sync_pct === 100 ? "fresh" : "warn"} hint="account_fresh" />
        <Metric label="position_sync" value={`${fmtNum(metrics.position_sync_pct)}%`} tone={metrics.position_sync_pct === 100 ? "fresh" : "warn"} hint="positions_fresh" />
        <Metric label="error_rate" value={`${fmtNum(metrics.error_rate_pct)}%`} tone={metrics.error_rate_pct === 0 ? "fresh" : "stale"} hint="failed polls" />
      </div>

      <div className="mt-3">
        <MT5HeartbeatDiagnostic
          reasons={diag.reasons}
          currentReason={diag.currentReason}
          heartbeatAgeS={diag.heartbeatAgeS}
          postMetrics={postMetrics}
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Quelle: <span className="font-mono">fetchMT5Snapshot</span> alle {POLL_MS / 1000}s. Zeitbasis
        <span className="font-mono text-primary"> server_time_ms</span> (Bridge-Host). Keine Order, kein Live-Execution.
      </p>
    </PanelCard>
  );
}