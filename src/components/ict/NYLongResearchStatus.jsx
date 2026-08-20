// A+ NY-LONG Research Status — Phase 2 / Phase 3 Sequential Validation
// Read-Only diagnostic panel showing the current validation state of the
// NY-LONG candidate edge. No execution, no optimization — display only.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { Lock, FlaskConical, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export default function NYLongResearchStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Fetch latest Phase 2/3 audit logs
        const logs = await base44.entities.AuditLog.list("-created_date", 20);
        const phaseLogs = (logs || []).filter(
          (l) =>
            l.event === "NY_LONG_OOS_VALIDATION_PHASE_2_FINAL" ||
            l.event === "NY_LONG_OOS_VALIDATION_PHASE_2" ||
            l.event === "NY_LONG_PHASE_3_SEQUENTIAL_VALIDATION"
        );
        const latest = phaseLogs[0];
        if (active) {
          setData(latest || null);
          setLoading(false);
        }
      } catch {
        if (active) {
          setData(null);
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="A+ NY-LONG Research Status">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const m = data?.metadata || {};
  const trades = m.trade_count || m.trades || 8;
  const requiredN = m.required_n || 82;
  const power = m.power || 0.279;
  const ci = m.ci_95 || m.confidence_interval || [-0.611, 1.611];
  const totalR = m.total_r ?? 4;
  const winrate = m.winrate ?? 50;
  const pf = m.profit_factor ?? 2;
  const cohensD = m.cohens_d ?? 0.31;
  const pValue = m.p_value ?? 0.7556;
  const finalClass = m.final_classification || "INCONCLUSIVE_UNDERPOWERED";
  const phase = data?.event?.includes("PHASE_3") ? "Phase 3" : "Phase 2";

  const classConfig = {
    EDGE_CONFIRMED: { icon: CheckCircle2, color: "profit", label: "EDGE CONFIRMED", glow: "glow-green" },
    INCONCLUSIVE_UNDERPOWERED: { icon: AlertTriangle, color: "warning", label: "INCONCLUSIVE / UNDERPOWERED", glow: "glow-amber" },
    EDGE_NOT_CONFIRMED: { icon: XCircle, color: "loss", label: "EDGE NOT CONFIRMED", glow: "glow-red" },
  };
  const cfg = classConfig[finalClass] || classConfig.INCONCLUSIVE_UNDERPOWERED;
  const ClassIcon = cfg.icon;

  return (
    <PanelCard
      title="A+ NY-LONG Research Status"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
          <FlaskConical className="h-3.5 w-3.5" />
          {phase} · Sequential Validation
        </span>
      }
    >
      {/* Phase 2 Reference */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Phase 2 (Referenz)</span>
          <span className="font-mono text-xs font-semibold text-warning">Candidate Edge / Not Confirmed</span>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          AuditLog: 6a8763caefaa9740e2b9eee8 · 8T · 50% WR · +4R · PF 2.0
        </div>
      </div>

      {/* Phase 3 Current Status */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Trades" value={`${trades}`} sub={`/ ${requiredN} Required`} color="primary" />
        <StatBox label="Power" value={power.toFixed(3)} sub="Target: 0.80" color={power >= 0.8 ? "profit" : "warning"} />
        <StatBox label="95% CI" value={`[${ci[0]}, ${ci[1]}]`} sub={ci[0] > 0 ? "Positiv" : "Enthält Null"} color={ci[0] > 0 ? "profit" : "warning"} />
        <StatBox label="Total R" value={`+${totalR}R`} sub={`PF ${pf}`} color={totalR >= 0 ? "profit" : "loss"} />
      </div>

      {/* Sequential Progress */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Sequential Validation Progress</div>
        <div className="flex items-center gap-1">
          {[10, 15, 20, 25, 30, 40, 50, 75, 100].map((n) => {
            const reached = trades >= n;
            return (
              <div
                key={n}
                className={`flex-1 rounded-sm py-1 text-center font-mono text-xs ${
                  reached ? "bg-profit/20 text-profit" : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {trades < 30
            ? `n=${trades} < 30 → UNDERPOWERED (MT5 Limit: 100k Candles blockiert weitere OOS-Daten)`
            : trades < requiredN
            ? `n=${trades} < Required N=${requiredN} → PROVISIONAL / UNDERPOWERED`
            : "Ausreichende Stichprobe erreicht"}
        </div>
      </div>

      {/* Statistics Detail */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 md:grid-cols-3">
        <DetailItem label="Winrate" value={`${winrate}%`} />
        <DetailItem label="Cohen's d" value={cohensD?.toFixed(2) || "0.31"} />
        <DetailItem label="p-value" value={pValue?.toFixed(4) || "0.7556"} />
      </div>

      {/* Final Classification */}
      <div className={`mt-4 flex items-center justify-between rounded-md border border-${cfg.color}/20 bg-${cfg.color}/5 px-3 py-2.5 ${cfg.glow}`}>
        <div className="flex items-center gap-2">
          <ClassIcon className={`h-4 w-4 text-${cfg.color}`} />
          <span className="text-xs font-medium text-muted-foreground">Final Classification</span>
        </div>
        <span className={`font-mono text-sm font-bold text-${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Governance */}
      <div className="mt-3 flex items-center gap-2 rounded-md border border-loss/20 bg-loss/5 px-3 py-2">
        <Lock className="h-3.5 w-3.5 text-loss" />
        <span className="font-mono text-xs text-loss">LIVE EXECUTION: BLOCKED</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">ORDER_SEND: BLOCKED</span>
      </div>

      {/* Data Limit Notice */}
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-warning">MT5 History Limit = 100.000 Candles.</span>{" "}
        DATA_EXPANSION = BLOCKED_BY_SOURCE_LIMIT. Keine künstliche Datengenerierung.
        NY-LONG bleibt CANDIDATE EDGE bis ausreichend unabhängige OOS-Historie verfügbar.
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
  };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
      <div className="font-mono text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}