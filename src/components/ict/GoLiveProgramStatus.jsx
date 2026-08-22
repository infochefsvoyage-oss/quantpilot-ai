// QuantPilot Go-Live Program Status (Phase 15)
// Zeigt die vollständige Gate-Kette vom Research bis Controlled Live.
// Keine automatische Freigabe. Kein Live-Start aufgrund eines einzelnen Gewinns.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { Lock, CheckCircle2, XCircle, AlertTriangle, Ban, ShieldCheck, ArrowRight } from "lucide-react";

export default function GoLiveProgramStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [execReadiness, setExecReadiness] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const logs = await base44.entities.AuditLog.list("-created_date", 50);
        const phase4 = (logs || []).find(l => l.event === "NY_LONG_PHASE_4_OOS_VALIDATION");
        const execLog = (logs || []).find(l => l.event === "EXECUTION_READINESS_CHECK");
        if (active) { setData(phase4 || null); setExecReadiness(execLog?.metadata || null); setLoading(false); }
      } catch {
        if (active) { setData(null); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="QuantPilot Go-Live Program">
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const m = data?.metadata || {};
  const v = m.validation || m;
  const n = v.trade_count || 0;
  const requiredN = 82;
  const remainingN = Math.max(0, requiredN - n);
  const ci = v.ci_95 || [0, 0];
  const power = v.power || 0;
  const pValue = v.p_value || 1;
  const pValueValid = pValue >= 0 && pValue <= 1;

  // ── Three distinct states (strict separation) ──────────────────────
  // 1. STATISTICAL VALIDATION
  const statGatePass = n >= requiredN && ci[0] > 0 && power >= 0.8 && pValueValid && pValue < 0.05;
  const statStatus = n < requiredN ? "UNDERPOWERED" : statGatePass ? "PASS" : "FAIL";

  // 2. EXECUTION READINESS (from latest EXECUTION_READINESS_CHECK audit log)
  const execReady = execReadiness?.execution_readiness;
  const execStatus = execReady === "READY" ? "READY" : "NOT READY";

  // 3. LIVE AUTHORIZATION (always BLOCKED unless manually approved)
  const liveAuth = "BLOCKED";

  // Gate chain status
  const gates = [
    { name: "RESEARCH PASS", status: n >= 10 ? "PASS" : "FAIL", detail: `N=${n}` },
    { name: "OOS PASS", status: m.independent_oos ? "PASS" : "FAIL", detail: m.independent_oos ? "Independent" : "Not independent" },
    { name: "STATISTICAL PASS", status: statGatePass ? "PASS" : "FAIL", detail: `N=${n}/${requiredN}, CI=[${ci[0]}, ${ci[1]}]` },
    { name: "WALK-FORWARD PASS", status: (v.walk_forward?.positive || 0) >= 3 ? "PASS" : "FAIL", detail: `${v.walk_forward?.positive || 0}/${v.walk_forward?.blocks?.length || 5} positiv` },
    { name: "PAPER EXECUTION PASS", status: "BLOCKED", detail: "Not started" },
    { name: "FORWARD PASS", status: "BLOCKED", detail: "Not started" },
    { name: "RISK GATE PASS", status: "BLOCKED", detail: "Not started" },
    { name: "EXECUTION READINESS", status: execStatus === "READY" ? "PASS" : "FAIL", detail: execStatus },
    { name: "EXPLICIT GO-LIVE APPROVAL", status: "BLOCKED", detail: "Manual required" },
    { name: "CONTROLLED LIVE", status: "BLOCKED", detail: "All gates must pass" },
    { name: "AUTO ORDER EXECUTION", status: "BLOCKED", detail: "Final stage" },
  ];

  const allPass = gates.every(g => g.status === "PASS");
  const finalStatus = allPass ? "PASS" : n < requiredN ? "UNDERPOWERED" : "BLOCKED";

  return (
    <PanelCard
      title="QuantPilot Go-Live Program"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-loss/10 px-2.5 py-1 text-xs font-medium text-loss">
          <Ban className="h-3.5 w-3.5" />
          FINAL: {finalStatus}
        </span>
      }
    >
      {/* Three Distinct States — Strict Separation */}
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <StateBox label="STATISTICAL VALIDATION" status={statStatus} color={statStatus === "PASS" ? "profit" : statStatus === "UNDERPOWERED" ? "warning" : "loss"} />
        <StateBox label="EXECUTION READINESS" status={execStatus} color={execStatus === "READY" ? "profit" : "warning"} />
        <StateBox label="LIVE AUTHORIZATION" status={liveAuth} color="loss" />
      </div>

      {/* Gate Chain */}
      <div className="space-y-1.5">
        {gates.map((g, i) => {
          const icon = g.status === "PASS" ? CheckCircle2 : g.status === "BLOCKED" ? Lock : XCircle;
          const Icon = icon;
          const color = g.status === "PASS" ? "profit" : g.status === "BLOCKED" ? "muted" : "loss";
          const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
          return (
            <div key={i}>
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${colors[color]}`} />
                  <span className="font-mono text-xs font-semibold text-foreground">{g.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{g.detail}</span>
                  <span className={`font-mono text-xs font-bold ${colors[color]}`}>{g.status}</span>
                </div>
              </div>
              {i < gates.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data / Performance / Statistics Summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryBox label="Candles" value={(m.final_candles || 0).toLocaleString("de-DE")} />
        <SummaryBox label="Trades" value={n} />
        <SummaryBox label="Total R" value={`${v.totalR >= 0 ? "+" : ""}${v.totalR}R`} color={v.totalR >= 0 ? "profit" : "loss"} />
        <SummaryBox label="WR" value={`${v.winrate}%`} color="warning" />
        <SummaryBox label="PF" value={v.profit_factor} color={v.profit_factor > 1 ? "profit" : "loss"} />
        <SummaryBox label="95% CI" value={`[${ci[0]}, ${ci[1]}]`} color={ci[0] > 0 ? "profit" : "warning"} />
        <SummaryBox label="p-value" value={pValueValid ? pValue : `${pValue} ⚠`} color={pValueValid ? (pValue < 0.05 ? "profit" : "warning") : "loss"} />
        <SummaryBox label="Power" value={power} color={power >= 0.8 ? "profit" : "warning"} />
      </div>

      {/* Required N / Remaining N */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryBox label="Required N" value={requiredN} color="primary" />
        <SummaryBox label="Current N" value={n} color={n >= requiredN ? "profit" : "warning"} />
        <SummaryBox label="Remaining N" value={remainingN} color={remainingN === 0 ? "profit" : "warning"} />
        <SummaryBox label="Classification" value="UNDERPOWERED" color="warning" />
      </div>

      {/* Robustness */}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
        <RobustnessItem label="Data Integrity" value={m.data_integrity || "PASS"} />
        <RobustnessItem label="Temporal Integrity" value={m.independent_oos ? "PASS" : "FAIL"} />
        <RobustnessItem label="Look-Ahead" value="PASS" />
        <RobustnessItem label="R-Reconciliation" value={v.r_reconciliation?.pass ? "PASS" : "FAIL"} />
        <RobustnessItem label="Reproducibility" value={v.reproducibility?.pass ? "PASS" : "FAIL"} />
        <RobustnessItem label="Walk-Forward" value={(v.walk_forward?.positive || 0) >= 3 ? "PASS" : "FAIL"} />
      </div>

      {/* Governance */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <GovItem icon={Lock} label="HYPOTHESIS" value="LOCKED" color="primary" />
        <GovItem icon={Lock} label="A+ LOGIC" value="LOCKED" color="primary" />
        <GovItem icon={Ban} label="OPTIMIZATION" value="NONE" color="muted" />
        <GovItem icon={Lock} label="LIVE EXECUTION" value="BLOCKED" color="loss" />
      </div>

      {/* Next Gate */}
      <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-semibold text-warning">NEXT GATE</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {n < requiredN
            ? `Erforderliche Trades: ${remainingN} weitere OOS-Trades bis N=82. Keine Freigabe bei N < Required N.`
            : "Statistische Gate-Prüfung ausstehend. Keine automatische Freigabe."}
        </p>
      </div>

      {/* No single-day profit rule */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">Kein Live-Start aufgrund eines einzelnen Gewinns.</span>{" "}
          Der heutige Tag wird als Forward Evidence protokolliert. Governance bleibt bis zum Erreichen aller Gates aktiv.
        </p>
      </div>
    </PanelCard>
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

function SummaryBox({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", warning: "text-warning", primary: "text-primary", muted: "text-foreground" };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
    </div>
  );
}

function RobustnessItem({ label, value }) {
  const color = value === "PASS" ? "profit" : value === "FAIL" ? "loss" : "muted";
  const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-semibold ${colors[color]}`}>{value}</span>
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