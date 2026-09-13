import React, { useEffect, useState } from "react";
import {
  CheckCircle2, Circle, Clock, Lock, AlertTriangle, Zap,
  Activity, Target, ShieldCheck, Calendar, TrendingUp,
} from "lucide-react";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import { base44 } from "@/api/base44Client";

// ─── GPT API Connection Panel ──────────────────────────────────────────────
function GptApiPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const resp = await base44.functions.invoke("gptApiHealthCheck", { active_probe: false });
        if (mounted) { setHealth(resp.data || resp); setError(null); }
      } catch (e) {
        if (mounted) setError(e?.message || "Health check failed");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const connected = health?.status === "CONNECTED";
  const statusColor = connected ? "profit" : health?.status === "NOT_CONFIGURED" ? "loss" : "warning";
  const statusLabel = loading ? "PRÜFE…" : connected ? "CONNECTED" : health?.status || "OFFLINE";

  return (
    <PanelCard
      title="GPT / OpenAI API Verbindung"
      action={<StatusBadge status={statusLabel} color={statusColor} />}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricBox label="Status" value={loading ? "…" : health?.status || "—"} good={connected} />
        <MetricBox label="Auth" value={loading ? "…" : health?.auth_valid === true ? "VALID" : health?.auth_valid === false ? "INVALID" : "—"} good={health?.auth_valid === true} />
        <MetricBox label="HTTP" value={loading ? "…" : health?.http_status || "—"} good={health?.http_status === 200} />
        <MetricBox label="Latenz" value={loading ? "…" : `${health?.latency_ms || 0}ms`} good={(health?.latency_ms || 999) < 2000} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoItem label="Monitor Mode" value={health?.monitor_mode || "—"} />
        <InfoItem label="Quota State" value={health?.quota_state || "UNKNOWN"} />
        <InfoItem label="Governance Effect" value={health?.governance_effect || "—"} />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <Lock className="h-3.5 w-3.5 text-loss" />
        <span className="font-mono text-xs text-muted-foreground">
          Order Send: <span className="text-loss">{health?.order_send || "BLOCKED"}</span> · Live Execution: <span className="text-loss">{health?.live_execution || "BLOCKED"}</span>
        </span>
      </div>
      {error && (
        <div className="mt-2 rounded border border-loss/20 bg-loss/5 px-2 py-1.5 font-mono text-xs text-loss">
          ERROR · {error}
        </div>
      )}
    </PanelCard>
  );
}

// ─── Milestone Data ─────────────────────────────────────────────────────────
const MILESTONES = [
  {
    phase: "Phase 1 — Infrastruktur & Daten",
    icon: Activity,
    status: "DONE",
    target: "Q4 2025",
    tasks: [
      { name: "MT5 Bridge E2E Verbindung", status: "done" },
      { name: "Binance/MEXC Live-Kurse (MEXC Mirror Fallback)", status: "done" },
      { name: "GPT/OpenAI API Health Check", status: "done" },
      { name: "Base44 Secrets für Credentials", status: "done" },
      { name: "AuditLog Governance Trail", status: "done" },
    ],
  },
  {
    phase: "Phase 2 — Strategie-Validierung",
    icon: Target,
    status: "IN_PROGRESS",
    target: "Q1 2026",
    tasks: [
      { name: "A+ Setup Definition FROZEN", status: "done" },
      { name: "20.000 Kerzen Backtest", status: "done" },
      { name: "Phase 4 OOS Validation — N=67 verbleibend", status: "active" },
      { name: "Walk-Forward Regression Test", status: "pending" },
      { name: "Bootstrap & Monte Carlo Robustheit", status: "pending" },
    ],
  },
  {
    phase: "Phase 3 — Execution Readiness",
    icon: ShieldCheck,
    status: "IN_PROGRESS",
    target: "Q2 2026",
    tasks: [
      { name: "Paper Execution Engine", status: "done" },
      { name: "Pre-Order Risk Gate (10 Guards)", status: "done" },
      { name: "Execution Readiness Check (DRY RUN)", status: "active" },
      { name: "GO-3 MT5 E2E Hardening (14/14 Matrix)", status: "active" },
      { name: "Full Reconciliation & Error Rate Audit", status: "pending" },
    ],
  },
  {
    phase: "Phase 4 — Go-Live Program (G1–G10)",
    icon: Zap,
    status: "IN_PROGRESS",
    target: "Q3 2026",
    tasks: [
      { name: "G1: MT5 E2E Hardening", status: "active" },
      { name: "G2: Market Data Integrity", status: "active" },
      { name: "G3: Strategy Frozen", status: "pending" },
      { name: "G4: Backtest Verified", status: "pending" },
      { name: "G5: OOS N=82 erreicht", status: "pending" },
      { name: "G6: Expectancy > 0 (konfident)", status: "pending" },
      { name: "G7: Shadow Mode bestanden", status: "pending" },
      { name: "G8: Semi-Auto Freigabe", status: "pending" },
      { name: "G9: Controlled Live", status: "pending" },
      { name: "G10: Safety Net aktiv", status: "pending" },
    ],
  },
  {
    phase: "Phase 5 — Live Authorization",
    icon: Lock,
    status: "BLOCKED",
    target: "06.09.2026",
    tasks: [
      { name: "OOS N=82 Schwelle erreicht", status: "blocked" },
      { name: "Alle G1–G10 Gates PASS", status: "blocked" },
      { name: "Governance 2-Step Approval (ULF)", status: "blocked" },
      { name: "Live Execution Global Unlock", status: "blocked" },
    ],
  },
];

const TASK_STATUS = {
  done: { icon: CheckCircle2, color: "text-profit", label: "ERLEDIGT", badge: "profit" },
  active: { icon: Clock, color: "text-warning", label: "LAUFEND", badge: "warning" },
  pending: { icon: Circle, color: "text-muted-foreground", label: "OFFEN", badge: "muted" },
  blocked: { icon: Lock, color: "text-loss", label: "BLOCKIERT", badge: "loss" },
};

const PHASE_STATUS = {
  DONE: { color: "profit", label: "ABGESCHLOSSEN" },
  IN_PROGRESS: { color: "warning", label: "LAUFEND" },
  BLOCKED: { color: "loss", label: "BLOCKIERT" },
};

// ─── Milestone Card ─────────────────────────────────────────────────────────
function MilestoneCard({ milestone }) {
  const PhaseIcon = milestone.icon;
  const phaseStatus = PHASE_STATUS[milestone.status];
  const doneCount = milestone.tasks.filter((t) => t.status === "done").length;
  const totalCount = milestone.tasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-${phaseStatus.color}/10`}>
            <PhaseIcon className={`h-4 w-4 text-${phaseStatus.color}`} />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">{milestone.phase}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{milestone.target}</span>
          <StatusBadge status={phaseStatus.label} color={phaseStatus.color} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">Fortschritt</span>
          <span className={`font-mono text-xs font-semibold text-${phaseStatus.color}`}>{doneCount}/{totalCount} · {progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full bg-${phaseStatus.color} transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-1.5">
        {milestone.tasks.map((task, i) => {
          const ts = TASK_STATUS[task.status];
          const TaskIcon = ts.icon;
          return (
            <div key={i} className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <TaskIcon className={`h-3.5 w-3.5 ${ts.color}`} />
                <span className="text-xs text-foreground">{task.name}</span>
              </div>
              <span className={`font-mono text-[10px] font-semibold ${ts.color}`}>{ts.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary KPIs ───────────────────────────────────────────────────────────
function MilestoneSummary({ milestones }) {
  const allTasks = milestones.flatMap((m) => m.tasks);
  const done = allTasks.filter((t) => t.status === "done").length;
  const active = allTasks.filter((t) => t.status === "active").length;
  const pending = allTasks.filter((t) => t.status === "pending").length;
  const blocked = allTasks.filter((t) => t.status === "blocked").length;
  const total = allTasks.length;
  const overallProgress = Math.round((done / total) * 100);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryCard icon={CheckCircle2} label="Erledigt" value={done} sub={`von ${total}`} color="profit" />
      <SummaryCard icon={Clock} label="Laufend" value={active} sub="in Bearbeitung" color="warning" />
      <SummaryCard icon={Circle} label="Offen" value={pending} sub="wartet" color="primary" />
      <SummaryCard icon={Lock} label="Blockiert" value={blocked} sub="Live gesperrt" color="loss" />
      <SummaryCard icon={TrendingUp} label="Gesamtfortschritt" value={`${overallProgress}%`} sub={`${done}/${total} Tasks`} color="primary" />
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────
function MetricBox({ label, value, good }) {
  return (
    <div className={`rounded-md border p-2.5 ${good ? "border-profit/20 bg-profit/5" : "border-border bg-secondary/30"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${good ? "text-profit" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/20 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    profit: "text-profit bg-profit/10",
    loss: "text-loss bg-loss/10",
    warning: "text-warning bg-warning/10",
    primary: "text-primary bg-primary/10",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${colors[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={`mt-2 font-mono text-xl font-bold ${colors[color].split(" ")[0]}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Meilensteinplan() {
  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Meilensteinplan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          QuantPilot AI – OP-777 · Task-Übersicht & Go-Live Roadmap · Ziel: 06.09.2026
        </p>
      </div>

      {/* GPT API Connection */}
      <GptApiPanel />

      {/* Summary KPIs */}
      <div className="mt-4">
        <MilestoneSummary milestones={MILESTONES} />
      </div>

      {/* Milestones */}
      <div className="mt-4 space-y-4">
        {MILESTONES.map((m, i) => (
          <MilestoneCard key={i} milestone={m} />
        ))}
      </div>

      {/* Target Date Banner */}
      <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Go-Live Ziel: 06.09.2026</span>
        </div>
        <p className="mt-1 pl-6 text-xs text-muted-foreground">
          Live-Authorization bleibt global blockiert bis OOS N=82 erreicht und alle G1–G10 Gates PASS sind.
          Kapitalerhalt hat absoluten Vorrang.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-warning">Keine Garantie.</span> Trading birgt Risiko des Totalverlusts.
            Alle Meilensteine sind Plan-Ziele, keine Versprechen.
          </p>
        </div>
      </div>
    </div>
  );
}