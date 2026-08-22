// QuantPilot — Forward Observation Panel
// Zeigt den Status des Forward-Observation-Collectors für die verbleibenden OOS-Trades.
// Drei Zustände strikt getrennt: STATISTICAL VALIDATION / EXECUTION READINESS / LIVE AUTHORIZATION.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import {
  Lock, Activity, Database, Ban, ShieldCheck, Radio,
  CheckCircle2, XCircle, AlertTriangle, PlayCircle, Loader2,
} from "lucide-react";

export default function ForwardObservationPanel() {
  const [obs, setObs] = useState(null);
  const [execReady, setExecReady] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [obsList, logs] = await Promise.all([
          base44.entities.ForwardObservation.list("-created_date", 10),
          base44.entities.AuditLog.list("-created_date", 50),
        ]);
        const execLog = (logs || []).find((l) => l.event === "EXECUTION_READINESS_CHECK");
        if (active) {
          setObs((obsList && obsList[0]) || null);
          setExecReady(execLog?.metadata || null);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const runCollector = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await base44.functions.invoke("runForwardObservation", {});
      setRunResult(res);
      // Refresh data
      const obsList = await base44.entities.ForwardObservation.list("-created_date", 10);
      setObs((obsList && obsList[0]) || null);
    } catch (e) {
      setRunResult({ status: "ERROR", error: e.message || "Run failed" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <PanelCard title="Forward Observation Collector">
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const s = obs?.statistics || {};
  const g = obs?.governance || {};
  const requiredN = s.required_n || 82;
  const currentN = s.n || obs?.cumulative_n || 0;
  const remainingN = s.remaining_n ?? Math.max(0, requiredN - currentN);
  const ci = s.ci_95 || [0, 0];
  const pValue = s.p_value ?? 1;
  const power = s.power ?? 0;
  const wf = s.walk_forward || {};

  // Three distinct states
  const statStatus = currentN < requiredN
    ? "UNDERPOWERED"
    : ci[0] > 0 && power >= 0.8 && pValue < 0.05
      ? "PASS"
      : "FAIL";
  const execStatus = execReady?.execution_readiness === "READY" ? "READY" : "NOT READY";
  const liveAuth = "BLOCKED";

  const statusConfig = {
    ACTIVE: { icon: Radio, color: "profit", label: "ACTIVE" },
    STALE: { icon: AlertTriangle, color: "warning", label: "STALE" },
    INVALID: { icon: XCircle, color: "loss", label: "INVALID" },
  };
  const fwdStatus = obs?.status || "INVALID";
  const StatusIcon = statusConfig[fwdStatus]?.icon || XCircle;
  const statusColor = statusConfig[fwdStatus]?.color || "loss";

  const lastTickDate = obs?.last_tick_timestamp
    ? new Date(obs.last_tick_timestamp * 1000).toLocaleString("de-DE")
    : "—";
  const oosEnd = obs?.oos_historical_end
    ? new Date(obs.oos_historical_end * 1000).toLocaleString("de-DE")
    : "—";
  const fwdCurrent = obs?.forward_observation_current
    ? new Date(obs.forward_observation_current * 1000).toLocaleString("de-DE")
    : "—";

  return (
    <PanelCard
      title="Forward Observation Collector"
      action={
        <button
          onClick={runCollector}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {running ? "Running..." : "Run Collector"}
        </button>
      }
    >
      {/* Status Banner */}
      <div className={`mb-4 flex items-center justify-between rounded-md border border-${statusColor}/30 bg-${statusColor}/5 px-3 py-2.5`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 text-${statusColor}`} />
          <span className="text-xs font-semibold text-muted-foreground">FORWARD OBSERVATION</span>
        </div>
        <span className={`font-mono text-sm font-bold text-${statusColor}`}>
          {statusConfig[fwdStatus]?.label || "INVALID"}
        </span>
      </div>

      {/* Run Result (if just ran) */}
      {runResult && (
        <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${
          runResult.status === "OK"
            ? "border-profit/30 bg-profit/5 text-profit"
            : "border-loss/30 bg-loss/5 text-loss"
        }`}>
          {runResult.status === "OK"
            ? `Run OK — ${runResult.new_trades_validated} new trades — N=${runResult.cumulative_n}/${runResult.required_n} — Feed: ${runResult.feed_status}`
            : `Run FAILED — ${runResult.error || runResult.reason || "Unknown error"}`}
        </div>
      )}

      {/* Data Source Info */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="Last Tick" value={lastTickDate} sub={obs?.data_source || "—"} color="muted" />
        <StatBox label="Tick Age" value={`${obs?.tick_age_ms?.toLocaleString("de-DE") || 0} ms`} sub={obs?.data_valid ? "FRESH" : "STALE"} color={obs?.data_valid ? "profit" : "warning"} />
        <StatBox label="Data Source" value={obs?.data_source || "—"} sub={obs?.forward_candle_count ? `${obs.forward_candle_count} candles` : "0"} color="muted" />
        <StatBox label="Feed Status" value={obs?.data_valid ? "LIVE" : "STALE"} sub={obs?.forward_candle_count > 0 ? "Forward data" : "No forward"} color={obs?.data_valid ? "profit" : "warning"} />
      </div>

      {/* Trade Counts */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="New OOS Trades" value={`${obs?.new_trades_detected ?? 0}`} sub="detected" color="primary" />
        <StatBox label="Validated OOS Trades" value={`${obs?.new_trades_validated ?? 0}`} sub="this run" color="profit" />
        <StatBox label="Duplicates Rejected" value={`${obs?.duplicates_rejected ?? 0}`} sub="deduped" color="warning" />
        <StatBox label="Reconciliation Failures" value={`${obs?.reconciliation_failures ?? 0}`} sub="R-mismatch" color="loss" />
      </div>

      {/* OOS Progress */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="OOS N" value={`${currentN}`} sub={`Hist ${s.historical_n ?? 0} + Fwd ${s.forward_n ?? 0}`} color="primary" />
        <StatBox label="Required N" value={`${requiredN}`} sub="FROZEN" color="muted" />
        <StatBox label="Remaining N" value={`${remainingN}`} sub={remainingN === 0 ? "erfüllt" : "ausständig"} color={remainingN === 0 ? "profit" : "warning"} />
        <StatBox label="Total R" value={`${s.total_r >= 0 ? "+" : ""}${s.total_r ?? 0}R`} sub={`PF ${s.profit_factor ?? 0}`} color={(s.total_r ?? 0) >= 0 ? "profit" : "loss"} />
      </div>

      {/* Three Distinct States — Strict Separation */}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <StateBox label="STATISTICAL VALIDATION" status={statStatus} color={statStatus === "PASS" ? "profit" : statStatus === "UNDERPOWERED" ? "warning" : "loss"} />
        <StateBox label="EXECUTION READINESS" status={execStatus} color={execStatus === "READY" ? "profit" : "warning"} />
        <StateBox label="LIVE AUTHORIZATION" status={liveAuth} color="loss" />
      </div>

      {/* Statistics Detail */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="Win Rate" value={`${s.win_rate ?? 0}%`} sub={`${s.n ?? 0} trades`} color="muted" />
        <StatBox label="Mean R" value={s.mean_r?.toFixed(3) ?? "0"} sub={`Median ${s.median_r ?? 0}`} color={(s.mean_r ?? 0) > 0 ? "profit" : "loss"} />
        <StatBox label="95% CI" value={`[${ci[0]}, ${ci[1]}]`} sub={ci[0] > 0 ? "positiv" : "enthält Null"} color={ci[0] > 0 ? "profit" : "warning"} />
        <StatBox label="p-value" value={pValue.toFixed(4)} sub={`Power ${power.toFixed(3)}`} color={pValue < 0.05 ? "profit" : "warning"} />
      </div>

      {/* Walk-Forward */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="Walk-Forward" value={`${wf.positive ?? 0}/${wf.total ?? 0}`} sub="positiv" color={(wf.positive ?? 0) >= 3 ? "profit" : "warning"} />
        <StatBox label="Negative Blocks" value={`${wf.negative ?? 0}`} sub="negativ" color="muted" />
        <StatBox label="Zero Blocks" value={`${wf.zero ?? 0}`} sub="neutral" color="muted" />
        <StatBox label="Max Drawdown" value={`${s.max_dd ?? 0}R`} sub={`Max LS ${s.max_loss_streak ?? 0}`} color={(s.max_dd ?? 0) <= 5 ? "profit" : "loss"} />
      </div>

      {/* Forward Boundary */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Forward Boundary</span>
          <span className="ml-auto text-xs text-muted-foreground">timestamp &gt; OOS_HISTORICAL_END</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-muted-foreground">OOS Historical End</span>
            <div className="font-mono font-semibold text-warning">{oosEnd}</div>
          </div>
          <div className="rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-muted-foreground">Forward Start</span>
            <div className="font-mono font-semibold text-primary">{oosEnd}</div>
          </div>
          <div className="rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-muted-foreground">Forward Current</span>
            <div className="font-mono font-semibold text-foreground">{fwdCurrent}</div>
          </div>
        </div>
      </div>

      {/* Governance */}
      <div className="grid grid-cols-2 gap-2">
        <GovItem icon={Lock} label="HYPOTHESIS" value="LOCKED" color="primary" />
        <GovItem icon={Ban} label="OPTIMIZATION" value="NONE" color="muted" />
        <GovItem icon={Ban} label="PARAM SEARCH" value="FORBIDDEN" color="loss" />
        <GovItem icon={Lock} label="ORDER SEND" value="BLOCKED" color="loss" />
        <GovItem icon={Lock} label="LIVE EXEC" value="BLOCKED" color="loss" />
        <GovItem icon={Database} label="STRATEGY" value={g.strategy_version || "NY_LONG_V1_FROZEN"} color="muted" />
      </div>

      {/* Observation Date + AuditLog ID */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Observation Date: <span className="font-mono font-semibold text-foreground">{obs?.observation_date || "—"}</span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">{obs?.id || "—"}</span>
      </div>

      {/* Notice */}
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-warning">Forward Observation sammelt ausschließlich zukünftige Daten.</span>{" "}
        Keine historische Erweiterung, keine Duplikate, keine Parameteränderung.{" "}
        Ein Tag mit 0 Trades ist ein gültiger Observation-Day. ORDER_SEND bleibt serverseitig BLOCKED — auch bei EXECUTION_READINESS=READY.
      </div>
    </PanelCard>
  );
}

function StatBox({ label, value, sub, color }) {
  const colors = {
    primary: "text-primary",
    profit: "text-profit",
    loss: "text-loss",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
      <div className="font-mono text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function StateBox({ label, status, color }) {
  const colors = {
    profit: "border-profit/30 bg-profit/5 text-profit",
    warning: "border-warning/30 bg-warning/10 text-warning",
    loss: "border-loss/30 bg-loss/5 text-loss",
  };
  return (
    <div className={`rounded-md border px-3 py-2.5 text-center ${colors[color]}`}>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${colors[color].split(" ").pop()}`}>{status}</div>
    </div>
  );
}

function GovItem({ icon: Icon, label, value, color }) {
  const colors = { primary: "text-primary", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <Icon className={`h-3.5 w-3.5 ${colors[color]}`} />
      <span className={`font-mono text-xs ${colors[color]}`}>{label}: {value}</span>
    </div>
  );
}