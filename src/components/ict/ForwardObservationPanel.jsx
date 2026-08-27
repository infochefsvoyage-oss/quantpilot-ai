// QuantPilot — Forward Observation Panel (AUDITED)
// Zeigt den Status des Forward-Observation-Collectors.
// Drei Zustände strikt getrennt: STATISTICAL VALIDATION / EXECUTION READINESS / LIVE AUTHORIZATION.
// Walk-Forward Regression: Previous vs Current.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import {
  Lock, Activity, Ban, ShieldCheck, Radio, XCircle, AlertTriangle, PlayCircle, Loader2, Clock,
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
  const historicalN = obs?.historical_oos_trades ?? s.historical_n ?? 0;
  const forwardN = obs?.forward_validated_trades ?? s.forward_n ?? 0;
  const totalN = obs?.cumulative_n ?? s.n ?? (historicalN + forwardN);
  const remainingN = s.remaining_n ?? Math.max(0, requiredN - totalN);
  const ci = s.ci_95 || [0, 0];
  const pValue = s.p_value ?? 1;
  const power = s.power ?? 0;

  // Three distinct states
  const statStatus = totalN < requiredN
    ? "UNDERPOWERED"
    : ci[0] > 0 && power >= 0.8 && pValue < 0.05
      ? "PASS"
      : "FAIL";
  const execStatus = execReady?.execution_readiness === "READY" ? "READY" : "NOT READY";
  const liveAuth = "BLOCKED";

  // Feed status
  const feedStatus = obs?.feed_status || "DISCONNECTED";
  const forwardDataAvailable = obs?.forward_data_available ?? false;
  const forwardDataValid = obs?.forward_data_valid ?? false;
  const statsUnchanged = obs?.statistics_unchanged ?? true;
  const wfRegression = obs?.walk_forward_regression || "PASS";

  // Walk-forward previous vs current
  const prevWF = s.previous_walk_forward || {};
  const currWF = s.current_walk_forward || {};
  const prevWFStr = `${prevWF.positive ?? 0}/${prevWF.total ?? 5}`;
  const currWFStr = `${currWF.positive ?? 0}/${currWF.total ?? 5}`;

  const feedConfig = {
    LIVE: { icon: Radio, color: "profit", label: "LIVE" },
    STALE: { icon: AlertTriangle, color: "warning", label: "STALE" },
    DISCONNECTED: { icon: XCircle, color: "loss", label: "DISCONNECTED" },
    INVALID: { icon: XCircle, color: "loss", label: "INVALID" },
  };
  const FeedIcon = feedConfig[feedStatus]?.icon || XCircle;
  const feedColor = feedConfig[feedStatus]?.color || "loss";

  const fmtTs = (ts) => ts ? new Date(ts * 1000).toLocaleString("de-DE") : "—";
  const fmtIso = (ts) => ts ? new Date(ts * 1000).toISOString() : "—";

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
      {/* MARKET DATA — Feed Status + Forward Data */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-2 flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">MARKET DATA</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatBox label="Feed Status" value={feedConfig[feedStatus]?.label || "DISCONNECTED"} sub={obs?.source_timezone || "UTC"} color={feedColor} />
          <StatBox label="Forward Data" value={forwardDataAvailable ? "AVAILABLE" : "NOT AVAILABLE"} sub={forwardDataValid ? "VALID" : "NOT VALID"} color={forwardDataValid ? "profit" : "warning"} />
          <StatBox label="Latest Tick" value={fmtTs(obs?.last_tick_timestamp)} sub={obs?.last_tick_timestamp ? fmtIso(obs?.last_tick_timestamp).split("T")[1]?.split(".")[0] + " UTC" : "—"} color="muted" />
          <StatBox label="Latest Candle" value={fmtTs(obs?.latest_candle_timestamp)} sub={obs?.latest_candle_timestamp ? fmtIso(obs?.latest_candle_timestamp).split("T")[1]?.split(".")[0] + " UTC" : "—"} color="muted" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatBox label="Tick Age" value={`${obs?.tick_age_ms?.toLocaleString("de-DE") || 0} ms`} sub={obs?.tick_age_ms < 120000 ? "FRESH" : "STALE"} color={obs?.tick_age_ms < 120000 ? "profit" : "warning"} />
          <StatBox label="Data Source" value={obs?.data_source || "—"} sub={obs?.data_source === "MOCK" ? "MOCK VERBOTEN" : "MT5 Bridge"} color={obs?.data_source === "MOCK" ? "loss" : "muted"} />
          <StatBox label="Forward Candles" value={`${obs?.forward_candle_count ?? 0}`} sub={forwardDataAvailable ? "after boundary" : "none after boundary"} color={forwardDataAvailable ? "profit" : "warning"} />
          <StatBox label="OOS Historical End" value={fmtTs(obs?.oos_historical_end)} sub="boundary (UTC)" color="warning" />
        </div>
      </div>

      {/* Status Banner */}
      <div className={`mb-3 flex items-center justify-between rounded-md border px-3 py-2.5 ${
        forwardDataValid ? "border-profit/30 bg-profit/5" :
        feedStatus === "STALE" ? "border-warning/30 bg-warning/10" :
        "border-loss/30 bg-loss/5"
      }`}>
        <div className="flex items-center gap-2">
          <FeedIcon className={`h-4 w-4 text-${feedColor}`} />
          <span className="text-xs font-semibold text-muted-foreground">FORWARD OBSERVATION</span>
        </div>
        <span className={`font-mono text-sm font-bold text-${feedColor}`}>
          {obs?.status || "INVALID"}
        </span>
      </div>

      {/* Run Result */}
      {runResult && (
        <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${
          runResult.status === "OK"
            ? "border-profit/30 bg-profit/5 text-profit"
            : "border-loss/30 bg-loss/5 text-loss"
        }`}>
          {runResult.status === "OK"
            ? `Run OK — Feed: ${runResult.feed_status} — Forward Data: ${runResult.forward_data_available ? "AVAILABLE" : "NOT AVAILABLE"} — N=${runResult.total_validated_oos_trades}/${runResult.required_n} — Stats Unchanged: ${runResult.statistics_unchanged} — WF Regression: ${runResult.walk_forward_regression}`
            : `Run FAILED — ${runResult.error || runResult.reason || "Unknown error"}`}
        </div>
      )}

      {/* Trade Counts */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="New OOS Trades" value={`${obs?.new_trades_detected ?? 0}`} sub="detected" color="primary" />
        <StatBox label="Validated OOS Trades" value={`${obs?.new_trades_validated ?? 0}`} sub="this run" color="profit" />
        <StatBox label="Duplicates Rejected" value={`${obs?.duplicates_rejected ?? 0}`} sub="deduped" color="warning" />
        <StatBox label="Reconciliation Failures" value={`${obs?.reconciliation_failures ?? 0}`} sub="R-mismatch" color="loss" />
      </div>

      {/* Historical / Forward / Total Separation */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="Historical OOS Trades" value={`${historicalN}`} sub="Phase 4 (frozen)" color="muted" />
        <StatBox label="Forward Validated Trades" value={`${forwardN}`} sub="new OOS" color={forwardN > 0 ? "profit" : "muted"} />
        <StatBox label="Total OOS Trades" value={`${totalN}`} sub={`Hist ${historicalN} + Fwd ${forwardN}`} color="primary" />
        <StatBox label="Total R" value={`${s.total_r >= 0 ? "+" : ""}${s.total_r ?? 0}R`} sub={`PF ${s.profit_factor ?? 0}`} color={(s.total_r ?? 0) >= 0 ? "profit" : "loss"} />
      </div>

      {/* OOS Progress */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="Required N" value={`${requiredN}`} sub="FROZEN" color="muted" />
        <StatBox label="Remaining N" value={`${remainingN}`} sub={remainingN === 0 ? "erfüllt" : "ausständig"} color={remainingN === 0 ? "profit" : "warning"} />
        <StatBox label="Win Rate" value={`${s.win_rate ?? 0}%`} sub={`${totalN} trades`} color="muted" />
        <StatBox label="Mean R" value={s.mean_r?.toFixed(3) ?? "0"} sub={`Median ${s.median_r ?? 0}`} color={(s.mean_r ?? 0) > 0 ? "profit" : "loss"} />
      </div>

      {/* Three Distinct States — Strict Separation */}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <StateBox label="STATISTICAL VALIDATION" status={statStatus} color={statStatus === "PASS" ? "profit" : statStatus === "UNDERPOWERED" ? "warning" : "loss"} />
        <StateBox label="EXECUTION READINESS" status={execStatus} color={execStatus === "READY" ? "profit" : "warning"} />
        <StateBox label="LIVE AUTHORIZATION" status={liveAuth} color="loss" />
      </div>

      {/* Statistical Stability */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">STATISTICAL STABILITY</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatBox label="95% CI" value={`[${ci[0]}, ${ci[1]}]`} sub={ci[0] > 0 ? "positiv" : "enthält Null"} color={ci[0] > 0 ? "profit" : "warning"} />
          <StatBox label="p-value" value={pValue.toFixed(4)} sub={`Power ${power.toFixed(3)}`} color={pValue < 0.05 ? "profit" : "warning"} />
          <StatBox label="Stats Unchanged" value={statsUnchanged ? "TRUE" : "FALSE"} sub={statsUnchanged ? "PASS" : "REGRESSION"} color={statsUnchanged ? "profit" : "loss"} />
          <StatBox label="Max Drawdown" value={`${s.max_dd ?? 0}R`} sub={`Max LS ${s.max_loss_streak ?? 0}`} color={(s.max_dd ?? 0) <= 5 ? "profit" : "loss"} />
        </div>
      </div>

      {/* Walk-Forward Regression Test */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">WALK-FORWARD REGRESSION TEST</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatBox label="Previous WF" value={prevWFStr} sub="positiv" color="muted" />
          <StatBox label="Current WF" value={currWFStr} sub="positiv" color={currWF.positive === prevWF.positive ? "profit" : "loss"} />
          <StatBox label="Regression" value={wfRegression} sub={wfRegression === "PASS" ? "unchanged" : "changed"} color={wfRegression === "PASS" ? "profit" : "loss"} />
          <StatBox label="WF Blocks" value={`${currWF.total ?? prevWF.total ?? 5}`} sub="total blocks" color="muted" />
        </div>
        {wfRegression === "FAIL" && forwardN === 0 && (
          <div className="mt-2 rounded border border-loss/30 bg-loss/5 px-2 py-1.5 text-xs text-loss">
            <span className="font-semibold">REGRESSION DETECTED:</span> Walk-Forward changed without new trades. Debug: Dataset-Boundary, Trade Filtering, idx mapping, Sortierung.
          </div>
        )}
      </div>

      {/* Forward Boundary */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">FORWARD BOUNDARY (UTC)</span>
          <span className="ml-auto text-xs text-muted-foreground">timestamp &gt; OOS_HISTORICAL_END (strict)</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-muted-foreground">OOS Historical End</span>
            <div className="font-mono font-semibold text-warning">{fmtTs(obs?.oos_historical_end)}</div>
          </div>
          <div className="rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-muted-foreground">Forward Start</span>
            <div className="font-mono font-semibold text-primary">{fmtTs(obs?.forward_observation_start)}</div>
          </div>
          <div className="rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-muted-foreground">Forward Current</span>
            <div className="font-mono font-semibold text-foreground">{fmtTs(obs?.forward_observation_current)}</div>
          </div>
        </div>
      </div>

      {/* Governance */}
      <div className="grid grid-cols-2 gap-2">
        <GovItem icon={Lock} label="HYPOTHESIS" value="LOCKED" color="primary" />
        <GovItem icon={Lock} label="A+ LOGIC" value="LOCKED" color="primary" />
        <GovItem icon={Ban} label="OPTIMIZATION" value="NONE" color="muted" />
        <GovItem icon={Ban} label="PARAM SEARCH" value="FORBIDDEN" color="loss" />
        <GovItem icon={Lock} label="ORDER SEND" value="BLOCKED" color="loss" />
        <GovItem icon={Lock} label="LIVE EXEC" value="BLOCKED" color="loss" />
      </div>

      {/* Observation Date + IDs */}
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
        STALE Feed darf als Observation-Day protokolliert werden, aber NICHT als gültige OOS-Evidenz.{" "}
        Ein Tag mit 0 Trades ist gültig. ORDER_SEND bleibt serverseitig BLOCKED — auch bei EXECUTION_READINESS=READY.
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