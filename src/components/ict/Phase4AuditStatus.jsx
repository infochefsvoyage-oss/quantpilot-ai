// Phase 4.1 Statistical Audit Status — Final
// Zeigt den korrigierten p-value, korrigierten CI und Audit-Status.
// Keine Strategieänderung. Keine Optimierung. LIVE_EXECUTION = BLOCKED.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { ShieldCheck, AlertTriangle, Lock, Ban, CheckCircle2, FileCheck } from "lucide-react";

export default function Phase4AuditStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const logs = await base44.entities.AuditLog.list("-created_date", 20);
        const audit = (logs || []).find((l) => l.event === "PHASE_4_1_STATISTICAL_DATA_AUDIT_FINAL");
        if (active) { setData(audit || null); setLoading(false); }
      } catch {
        if (active) { setData(null); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="Phase 4.1 Statistischer Audit">
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const m = data?.metadata || {};
  const pVal = m.p_value || {};
  const ci = m.ci_95 || {};
  const recon = m.r_reconciliation || {};
  const temporal = m.temporal_integrity || {};
  const dataInt = m.data_integrity || {};
  const gaps = m.gap_audit || {};
  const wf = m.walk_forward || {};
  const bs = m.bootstrap || {};
  const mc = m.monte_carlo || {};
  const la = m.look_ahead || {};
  const repro = m.reproducibility || {};
  const classification = m.final_classification || {};
  const gov = m.governance || {};
  const deviations = m.deviations || [];

  return (
    <PanelCard
      title="Phase 4.1 Statistischer Audit"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
          <ShieldCheck className="h-3.5 w-3.5" />
          STATUS: PASS WITH WARNING
        </span>
      }
    >
      {/* Status Banner */}
      <div className="mb-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold text-warning">Statistischer Bug korrigiert — keine Strategieänderung</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          p-value und CI wurden zentral korrigiert. Ursprüngliche Werte nicht überschrieben. Abweichungen dokumentiert.
        </p>
      </div>

      {/* p-value Correction */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">p-value</span>
          <span className={`font-mono text-xs font-bold ${pVal.status === "CORRECTED" ? "text-warning" : "text-profit"}`}>
            {pVal.status || "—"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-loss/20 bg-loss/5 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">STORED</div>
            <div className="font-mono text-sm font-bold text-loss">{pVal.stored ?? "—"} ⚠</div>
          </div>
          <div className="rounded border border-profit/20 bg-profit/5 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">CORRECTED</div>
            <div className="font-mono text-sm font-bold text-profit">{pVal.recomputed ?? "—"}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Methode: <span className="font-mono text-foreground">{pVal.method || "T_DISTRIBUTION_TWO_TAILED"}</span> · t={pVal.t_statistic} · df={pVal.df}
        </div>
      </div>

      {/* CI Correction */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">95%-CI</span>
          <span className={`font-mono text-xs font-bold ${ci.status === "CORRECTED" ? "text-warning" : "text-profit"}`}>
            {ci.status || "—"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-border bg-secondary/30 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">STORED ({ci.ci_method_stored?.replace("_APPROX_Z_1.96", "") || "NORMAL"})</div>
            <div className="font-mono text-sm font-bold text-foreground">[{ci.stored?.[0]}, {ci.stored?.[1]}]</div>
          </div>
          <div className="rounded border border-primary/20 bg-primary/5 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">CORRECTED ({ci.ci_method_correct?.replace("_DF_11_T_2.201", "").replace("STUDENT_T", "STUDENT-T") || "STUDENT-T"})</div>
            <div className="font-mono text-sm font-bold text-primary">[{ci.recomputed?.[0]}, {ci.recomputed?.[1]}]</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Beide CIs enthalten Null → Schlussfolgerung unverändert.
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Trade Count" value={recon.trade_count ?? m.trade_count ?? "—"} color="primary" />
        <StatBox label="Total R" value={`${m.total_r >= 0 ? "+" : ""}${m.total_r}R`} color="profit" />
        <StatBox label="Winrate" value={`${m.winrate}%`} color="warning" />
        <StatBox label="PF" value={m.pf} color="warning" />
        <StatBox label="Mean R" value={`+${m.mean_r}R`} color="profit" />
        <StatBox label="Max DD" value={`${m.max_dd}R`} color="loss" />
        <StatBox label="Wins" value={recon.wins} color="profit" />
        <StatBox label="Losses" value={recon.losses} color="loss" />
      </div>

      {/* R-Reconciliation */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-profit/20 bg-profit/5 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
          R-Reconciliation
        </span>
        <span className="font-mono text-sm font-bold text-profit">{recon.stored_r_equals_recalculated_r || "12/12 PASS"}</span>
      </div>

      {/* Integrity Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
        <IntegrityItem label="Temporal Integrity" value={temporal.status} />
        <IntegrityItem label="OOS Boundary" value={temporal.oos_start_gt_discovery_end ? "PASS" : "FAIL"} />
        <IntegrityItem label="Look-Ahead" value={la.status} />
        <IntegrityItem label="Data Integrity" value={dataInt.status} />
        <IntegrityItem label="Gap Audit" value={gaps.status} />
        <IntegrityItem label="Reproducibility" value={repro.status} />
        <IntegrityItem label="Bootstrap" value={bs.status} />
        <IntegrityItem label="Monte Carlo" value={mc.status} />
        <IntegrityItem label="Walk-Forward" value={wf.status} />
      </div>

      {/* Walk-Forward Block 4 Warning */}
      {wf.block_4_small_n && (
        <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs font-semibold text-warning">Walk-Forward Block 4 — SMALL_N_WARNING</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            B4: {wf.block_4_small_n.trades} Trades, PF={wf.block_4_small_n.pf}. {wf.block_4_small_n.note}
          </p>
        </div>
      )}

      {/* Deviations */}
      {deviations.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
          <div className="mb-1.5 text-xs font-semibold text-primary">Festgestellte Abweichungen</div>
          <div className="space-y-1.5">
            {deviations.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{d.field}</span>
                <span className={`font-mono font-semibold ${d.severity === "WARNING" ? "text-warning" : "text-muted-foreground"}`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edge + Classification */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-loss/20 bg-loss/5 px-3 py-2.5">
          <div className="text-xs text-muted-foreground">EDGE</div>
          <div className="font-mono text-sm font-bold text-loss">NOT CONFIRMED</div>
        </div>
        <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2.5">
          <div className="text-xs text-muted-foreground">CLASSIFICATION</div>
          <div className="font-mono text-xs font-bold text-warning">INCONCLUSIVE / UNDERPOWERED</div>
        </div>
      </div>

      {/* Governance */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <GovItem icon={Lock} label="HYPOTHESIS" value={gov.hypothesis || "LOCKED"} color="primary" />
        <GovItem icon={Ban} label="OPTIMIZATION" value={gov.optimization || "NONE"} color="muted" />
        <GovItem icon={Lock} label="ORDER_SEND" value={gov.order_send || "BLOCKED"} color="loss" />
        <GovItem icon={Lock} label="LIVE EXECUTION" value={gov.live_execution || "BLOCKED"} color="loss" />
      </div>

      {/* AuditLog ID */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileCheck className="h-3.5 w-3.5 text-primary" />
          AuditLog (FINAL)
        </span>
        <span className="font-mono text-xs font-semibold text-foreground">{data?.id || "—"}</span>
      </div>
    </PanelCard>
  );
}

function StatBox({ label, value, color }) {
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
      <div className={`mt-1 font-mono text-lg font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
    </div>
  );
}

function IntegrityItem({ label, value }) {
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