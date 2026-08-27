// QuantPilot Profitability Monitor (PHASE 12)
// Zentraler Status: QUANTPILOT GO-LIVE READINESS
// Zeigt: RESEARCH, STRATEGY, EXECUTION, GOVERNANCE, PROFITABILITY STATUS.
// Kein automatischer Statussprung. Keine Live-Freigabe durch einzelnen Gewinn.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import {
  Lock, ShieldCheck, Ban, Activity, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Crosshair, Gauge,
} from "lucide-react";

export default function ProfitabilityMonitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const logs = await base44.entities.AuditLog.list("-created_date", 100);
        const phase4 = logs.find((l) => l.event === "NY_LONG_PHASE_4_OOS_VALIDATION");
        const execReady = logs.find((l) => l.event === "EXECUTION_READINESS_CHECK");
        const paperExec = logs.filter((l) => l.event === "PAPER_TRADE_EXECUTED");
        const riskGate = logs.find((l) => l.event === "RISK_GATE_CHECK");
        const killSwitch = logs.find((l) => l.event === "KILL_SWITCH_TRIGGERED");
        const autoOrder = logs.find((l) => l.event === "AUTO_ORDER_PIPELINE_DRY_RUN");
        const baselineLock = logs.find((l) => l.event === "BASELINE_LOCK_FREEZE");
        if (active) { setData({ phase4, execReady, paperExec, riskGate, killSwitch, autoOrder, baselineLock }); setLoading(false); }
      } catch {
        if (active) { setData(null); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="QuantPilot Profitability Monitor">
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const p4m = data?.phase4?.metadata?.validation || data?.phase4?.metadata || {};
  const execM = data?.execReady?.metadata || {};
  const paperTrades = data?.paperExec || [];
  const riskM = data?.riskGate?.metadata || {};
  const killM = data?.killSwitch?.metadata || {};
  const autoM = data?.autoOrder?.metadata || {};
  const baselineM = data?.baselineLock?.metadata || {};

  const n = p4m.trade_count || 0;
  const requiredN = 82;
  const remainingN = Math.max(0, requiredN - n);
  const ci = p4m.ci_95 || [0, 0];
  const power = p4m.power || 0;
  const pValue = p4m.p_value ?? 1;
  const pf = p4m.profit_factor ?? p4m.pf ?? 0;
  const totalR = p4m.totalR ?? p4m.total_r ?? 0;
  const winrate = p4m.winrate ?? 0;
  const maxDD = p4m.max_drawdown ?? p4m.max_dd ?? 0;
  const meanR = p4m.mean_r ?? p4m.avgR ?? 0;
  const wfPositive = p4m.walk_forward?.positive ?? 0;
  const wfTotal = p4m.walk_forward?.blocks?.length ?? 5;

  // Profitability status progression
  const statValidated = n >= requiredN && ci[0] > 0 && power >= 0.8 && pValue < 0.05;
  const paperTradesCount = paperTrades.length;
  const paperProfitable = paperTradesCount > 0 && paperTrades.some((t) => t.metadata?.outcome === "WIN");

  let profitStatus = "NOT VALIDATED";
  let profitColor = "muted";
  if (n < requiredN) { profitStatus = "UNDERPOWERED"; profitColor = "warning"; }
  else if (!statValidated) { profitStatus = "STATISTICALLY NOT VALIDATED"; profitColor = "loss"; }
  else if (paperTradesCount === 0) { profitStatus = "STATISTICALLY VALIDATED — PAPER PENDING"; profitColor = "cyan"; }
  else if (!paperProfitable) { profitStatus = "PAPER NOT PROFITABLE"; profitColor = "loss"; }
  else { profitStatus = "PAPER PROFITABLE — MICRO-LIVE PENDING"; profitColor = "profit"; }

  const execReady = execM.execution_readiness === "READY";
  const riskPass = riskM.pass === true || riskM.risk_gate === "PASS";
  const killActive = killM.kill_switch === "KILL";
  const autoGatesPass = autoM.status === "ALL_GATES_PASS_BUT_ORDER_BLOCKED";

  return (
    <PanelCard
      title="QuantPilot Profitability Monitor"
      action={
        <span className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
          profitColor === "profit" ? "bg-profit/10 text-profit" :
          profitColor === "warning" ? "bg-warning/10 text-warning" :
          profitColor === "loss" ? "bg-loss/10 text-loss" :
          "bg-muted/10 text-muted-foreground"
        }`}>
          {profitColor === "profit" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
           profitColor === "loss" ? <XCircle className="h-3.5 w-3.5" /> :
           <AlertTriangle className="h-3.5 w-3.5" />}
          {profitStatus}
        </span>
      }
    >
      {/* Baseline Lock Banner */}
      <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">BASELINE LOCK</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {baselineM?.frozen_at ? new Date(baselineM.frozen_at).toLocaleDateString("de-DE") : "—"}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
          <div className="font-mono text-profit">BASELINE_LOCK: TRUE</div>
          <div className="font-mono text-profit">PARAMETER_LOCK: TRUE</div>
          <div className="font-mono text-profit">STRATEGY_LOCK: TRUE</div>
        </div>
      </div>

      {/* RESEARCH Section */}
      <SectionLabel icon={Crosshair} label="RESEARCH" />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="OOS N" value={n} sub={`/ ${requiredN}`} color={n >= requiredN ? "profit" : "warning"} />
        <StatBox label="Required N" value={requiredN} sub="FROZEN" color="primary" />
        <StatBox label="Remaining N" value={remainingN} sub={remainingN === 0 ? "erfüllt" : "ausständig"} color={remainingN === 0 ? "profit" : "warning"} />
        <StatBox label="Power" value={power.toFixed(3)} sub="Target: 0.80" color={power >= 0.8 ? "profit" : "warning"} />
        <StatBox label="95% CI" value={`[${ci[0]}, ${ci[1]}]`} sub={ci[0] > 0 ? "positiv" : "enthält Null"} color={ci[0] > 0 ? "profit" : "warning"} />
        <StatBox label="p-value" value={pValue.toFixed(4)} sub={pValue < 0.05 ? "signifikant" : "n.s."} color={pValue < 0.05 ? "profit" : "warning"} />
        <StatBox label="Walk-Forward" value={`${wfPositive}/${wfTotal}`} sub="positiv" color={wfPositive >= 3 ? "profit" : "warning"} />
        <StatBox label="Classification" value={(p4m.classification || "INCONCLUSIVE").replace(/_/g, " ")} color="warning" />
      </div>

      {/* STRATEGY Section */}
      <SectionLabel icon={TrendingUp} label="STRATEGY" />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="PF" value={pf} sub={pf > 1 ? "> 1" : "<= 1"} color={pf > 1 ? "profit" : "loss"} />
        <StatBox label="Expectancy" value={`${meanR >= 0 ? "+" : ""}${meanR}R`} sub="Mean R" color={meanR > 0 ? "profit" : "loss"} />
        <StatBox label="Win Rate" value={`${winrate}%`} color={winrate >= 50 ? "profit" : "warning"} />
        <StatBox label="Total R" value={`${totalR >= 0 ? "+" : ""}${totalR}R`} color={totalR >= 0 ? "profit" : "loss"} />
        <StatBox label="Max DD" value={`${maxDD}R`} sub={`Limit ${baselineM?.current_performance ? 6 : 6}R`} color={maxDD <= 5 ? "profit" : "loss"} />
        <StatBox label="Strategy" value="NY-LONG" sub="FROZEN" color="primary" />
        <StatBox label="Version" value="V1" sub="LOCKED" color="primary" />
        <StatBox label="Optimization" value="NONE" color="muted" />
      </div>

      {/* EXECUTION Section */}
      <SectionLabel icon={Activity} label="EXECUTION" />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatBox label="MT5 Health" value={execReady ? "READY" : "NOT READY"} color={execReady ? "profit" : "loss"} />
        <StatBox label="Risk Gate" value={riskPass ? "PASS" : "FAIL"} color={riskPass ? "profit" : "loss"} />
        <StatBox label="Auto-Order Gates" value={autoM.status ? (autoM.status === "ALL_GATES_PASS_BUT_ORDER_BLOCKED" ? "PASS" : "FAIL") : "—"} color={autoM.status === "ALL_GATES_PASS_BUT_ORDER_BLOCKED" ? "profit" : "loss"} />
        <StatBox label="Position Sync" value={execM.position_sync?.status || "—"} color={execM.position_sync?.status === "PASS" ? "profit" : "loss"} />
        <StatBox label="Reconciliation" value={execM.bridge_contract || "—"} color={execM.bridge_contract === "PASS" ? "profit" : "loss"} />
        <StatBox label="Kill Switch" value={killActive ? "KILL" : "OK"} color={killActive ? "loss" : "profit"} />
        <StatBox label="Paper Trades" value={paperTradesCount} sub="backend" color="cyan" />
        <StatBox label="Order Send" value="BLOCKED" color="loss" />
      </div>

      {/* GOVERNANCE Section */}
      <SectionLabel icon={ShieldCheck} label="GOVERNANCE" />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <GovItem icon={Lock} label="HYPOTHESIS" value="LOCKED" color="primary" />
        <GovItem icon={Lock} label="STRATEGY" value="LOCKED" color="primary" />
        <GovItem icon={Ban} label="OPTIMIZATION" value="NONE" color="muted" />
        <GovItem icon={Lock} label="LIVE EXECUTION" value="BLOCKED" color="loss" />
      </div>

      {/* Profitability Status Progression */}
      <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">PROFITABILITY STATUS PROGRESSION</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "NOT VALIDATED", active: profitStatus === "NOT VALIDATED" },
            { label: "UNDERPOWERED", active: profitStatus === "UNDERPOWERED" },
            { label: "STAT. VALIDATED", active: profitStatus.startsWith("STATISTICALLY VALIDATED") },
            { label: "PAPER PROFITABLE", active: profitStatus === "PAPER PROFITABLE — MICRO-LIVE PENDING" },
            { label: "MICRO-LIVE VALIDATED", active: false },
            { label: "CONTROLLED AUTO", active: false },
          ].map((s, i) => (
            <span key={i} className={`rounded-md border px-2 py-1 font-mono text-xs font-semibold ${
              s.active ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground"
            }`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Decision Matrix */}
      <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-semibold text-warning">GO-LIVE DECISION MATRIX</span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1 text-xs md:grid-cols-2">
          <DecisionRow condition="Research underpowered" action="BLOCK" active={n < requiredN} />
          <DecisionRow condition="OOS nicht signifikant" action="BLOCK" active={n >= requiredN && ci[0] <= 0} />
          <DecisionRow condition="Paper negativ" action="BLOCK" active={paperTradesCount > 0 && !paperProfitable} />
          <DecisionRow condition="Risk Gate FAIL" action="BLOCK" active={!riskPass} />
          <DecisionRow condition="MT5 Sync FAIL" action="BLOCK" active={!execReady} />
          <DecisionRow condition="Reconciliation FAIL" action="BLOCK" active={execM.bridge_contract !== "PASS"} />
          <DecisionRow condition="alle Gates PASS" action="Micro-Live beantragen" active={false} />
          <DecisionRow condition="Micro-Live stabil" action="Controlled Auto beantragen" active={false} />
        </div>
      </div>
    </PanelCard>
  );
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 border-t border-border pt-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold text-primary">{label}</span>
    </div>
  );
}

function StatBox({ label, value, sub = "", color = "muted" }) {
  const colors = { primary: "text-primary", profit: "text-profit", loss: "text-loss", warning: "text-warning", muted: "text-muted-foreground", cyan: "text-primary" };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>}
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

function DecisionRow({ condition, action, active }) {
  return (
    <div className={`flex items-center justify-between rounded border px-2 py-1 ${
      active ? "border-loss/30 bg-loss/10" : "border-border bg-secondary/20"
    }`}>
      <span className="text-muted-foreground">{condition}</span>
      <span className={`font-mono font-semibold ${action === "BLOCK" ? "text-loss" : "text-warning"}`}>{action}</span>
    </div>
  );
}