import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { Activity, Radar, ShieldCheck, Lock, RefreshCw, Play, Pause, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import { analyzeICT, generatePaperSignal, getCurrentSession } from "@/lib/ictEngine";

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

const Metric = memo(function Metric({ label, value, tone = "default", hint }) {
  const toneClass = {
    default: "text-foreground",
    fresh: "text-profit",
    stale: "text-loss",
    warn: "text-warning",
    cyan: "text-primary",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono-num text-sm font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
    </div>
  );
});

const GateRow = memo(function GateRow({ label, passed }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-bold ${passed ? "text-profit" : "text-loss"}`}>
        {passed ? "PASS" : "FAIL"}
      </span>
    </div>
  );
});

const SafetyBadge = memo(function SafetyBadge({ label, state }) {
  const isBlocked = state === "BLOCKED" || state === "ON";
  return (
    <div className={`rounded-md border px-3 py-2 text-center ${isBlocked ? "border-loss/30 bg-loss/10" : "border-profit/30 bg-profit/10"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${isBlocked ? "text-loss" : "text-profit"}`}>{state}</div>
    </div>
  );
});

export default function ICTPipelineMonitor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const invokeStartRef = useRef(0);

  const poll = useCallback(async () => {
    invokeStartRef.current = performance.now();
    try {
      const res = await base44.functions.invoke("fetchICTPipelineSnapshot", {});
      const snap = res?.data ?? res;
      setData(snap);
      setError(snap?.reachable === false ? snap?.error || "bridge unreachable" : null);
    } catch (e) {
      setError(e?.message || "invoke failed");
    }
    setLastFetch(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [running, poll]);

  // Run ICT engine on real candles — measure compute time
  const ictAnalysis = useMemo(() => {
    if (!data?.candles || data.candles.length < 10) return null;
    const t0 = performance.now();
    const longAnalysis = analyzeICT(data.candles, "LONG");
    const shortAnalysis = analyzeICT(data.candles, "SHORT");
    const session = getCurrentSession();
    const longSignal = generatePaperSignal(longAnalysis, { bid: data.bid });
    const shortSignal = generatePaperSignal(shortAnalysis, { bid: data.bid });
    const computeMs = performance.now() - t0;
    return { longAnalysis, shortAnalysis, longSignal, shortSignal, session, computeMs };
  }, [data]);

  const dashboardLatencyMs = lastFetch && data?.fetched_at
    ? new Date(lastFetch).getTime() - new Date(data.fetched_at).getTime()
    : null;

  const totalPipelineMs = data?.ingestion_latency_ms != null && ictAnalysis?.computeMs != null
    ? data.ingestion_latency_ms + ictAnalysis.computeMs
    : null;

  const reachable = data?.reachable === true;
  const ratesOk = data?.rates_available === true;
  const tickFresh = data?.tick_fresh === true;
  const candleComplete = data?.candle_complete === true;
  const hbHealthy = data?.heartbeat_state === "HEALTHY";

  return (
    <PanelCard
      title="ICT PIPELINE — READ-ONLY PERFORMANCE"
      action={
        <div className="flex items-center gap-2">
          <StatusBadge
            status={!reachable ? "OFFLINE" : !ratesOk ? "NO_RATES" : !tickFresh ? "STALE" : "LIVE"}
            color={!reachable ? "loss" : !ratesOk ? "warning" : !tickFresh ? "warning" : "profit"}
          />
          <button onClick={() => setRunning(r => !r)} className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-muted">
            {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {running ? "Pause" : "Start"}
          </button>
          <button onClick={poll} className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-muted">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      }
    >
      {/* Safety State */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SafetyBadge label="READ_ONLY" state="ON" />
        <SafetyBadge label="ORDER_CHECK" state="ALLOWED" />
        <SafetyBadge label="ORDER_SEND" state="BLOCKED" />
        <SafetyBadge label="LIVE_EXEC" state="BLOCKED" />
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-loss/30 bg-loss/10 px-3 py-1.5 text-xs text-loss">
          {error}
        </div>
      )}

      {!reachable && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Bridge nicht erreichbar — Pipeline kann nicht gemessen werden.
        </div>
      )}

      {/* Pipeline Latencies */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Pipeline-Latenzen
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="health_ms" value={fmtMs(data?.latencies?.health_ms)} tone="cyan" />
          <Metric label="tick_ms" value={fmtMs(data?.latencies?.tick_ms)} tone="cyan" />
          <Metric label="rates_ms" value={fmtMs(data?.latencies?.rates_ms)} tone={ratesOk ? "cyan" : "stale"} />
          <Metric label="account_ms" value={fmtMs(data?.latencies?.account_ms)} tone="cyan" />
          <Metric label="positions_ms" value={fmtMs(data?.latencies?.positions_ms)} tone="cyan" />
          <Metric label="heartbeat_ms" value={fmtMs(data?.latencies?.heartbeat_ms)} tone="cyan" />
          <Metric label="ingestion_ms" value={fmtMs(data?.ingestion_latency_ms)} tone="cyan" hint="Bridge → QuantPilot" />
          <Metric label="ict_compute_ms" value={fmtMs(ictAnalysis?.computeMs)} tone="cyan" hint="Frontend ICT Engine" />
          <Metric label="dashboard_ms" value={fmtMs(dashboardLatencyMs)} tone="cyan" hint="Signal → Dashboard" />
          <Metric label="total_pipeline" value={fmtMs(totalPipelineMs)} tone={totalPipelineMs != null && totalPipelineMs < 5000 ? "fresh" : "warn"} hint="MT5 → Dashboard" />
        </div>
      </div>

      {/* Tick & Market Data */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Radar className="h-3.5 w-3.5 text-primary" />
          Tick & Market Data — XAUUSD
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

      {/* M1 Candle Completeness */}
      <div className="mb-3">
        <div className="mb-2 text-xs font-semibold text-foreground">M1 Candle-Vollständigkeit</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="candle_count" value={data?.candle_count ?? 0} tone="cyan" />
          <Metric label="candle_gaps" value={data?.candle_gaps ?? 0} tone={data?.candle_gaps > 0 ? "stale" : "fresh"} />
          <Metric label="last_candle_age" value={fmtMs(data?.last_candle_age_ms)} tone={data?.last_candle_age_ms != null && data.last_candle_age_ms < 120000 ? "fresh" : "warn"} />
          <Metric label="candle_complete" value={candleComplete ? "TRUE" : "FALSE"} tone={candleComplete ? "fresh" : "stale"} />
        </div>
      </div>

      {/* Account & Positions */}
      <div className="mb-3">
        <div className="mb-2 text-xs font-semibold text-foreground">Account & Positionen</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="equity" value={fmtNum(data?.equity)} tone="cyan" />
          <Metric label="free_margin" value={fmtNum(data?.free_margin)} tone="cyan" />
          <Metric label="balance" value={fmtNum(data?.balance)} tone="cyan" />
          <Metric label="currency" value={data?.currency ?? "–"} />
          <Metric label="positions" value={data?.positions_count ?? 0} tone={(data?.positions_count ?? 0) > 0 ? "warn" : "fresh"} />
        </div>
      </div>

      {/* Heartbeat */}
      <div className="mb-3">
        <div className="mb-2 text-xs font-semibold text-foreground">Heartbeat-Stabilität</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="state" value={data?.heartbeat_state ?? "–"} tone={hbHealthy ? "fresh" : "stale"} />
          <Metric label="age_s" value={fmtNum(data?.heartbeat_age_s, 1)} tone={hbHealthy ? "fresh" : "stale"} />
          <Metric label="post_success" value={data?.heartbeat_post_success ?? 0} tone="fresh" />
          <Metric label="post_failures" value={data?.heartbeat_post_failures ?? 0} tone={(data?.heartbeat_post_failures ?? 0) > 0 ? "stale" : "fresh"} />
          <Metric label="failure_rate" value={`${fmtNum(data?.heartbeat_failure_rate, 2)}%`} tone={(data?.heartbeat_failure_rate ?? 0) === 0 ? "fresh" : "stale"} />
        </div>
      </div>

      {/* ICT Analysis */}
      {ictAnalysis ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Radar className="h-3.5 w-3.5 text-primary" />
            ICT Engine — Real M1 Candles
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
        ICT-Engine läuft auf echten M1-Candles · Keine Order, kein Live-Execution.
      </p>
    </PanelCard>
  );
}

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
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-foreground">{label}</span>
        <StatusBadge
          status={analysis.setup}
          color={analysis.setup === "VALID" ? "profit" : analysis.setup === "WATCH_ONLY" ? "warning" : "loss"}
        />
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