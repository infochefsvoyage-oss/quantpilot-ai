import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Circle, Clock, Lock, AlertTriangle, Zap,
  Activity, Target, ShieldCheck, Calendar, TrendingUp, RefreshCw,
  Wifi, WifiOff, GitBranch, Ban,
} from "lucide-react";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import { base44 } from "@/api/base44Client";

const ICONS = { Activity, Target, ShieldCheck, Zap, Lock };

const STATUS_STYLE = {
  done: { icon: CheckCircle2, text: "text-profit", label: "ERLEDIGT", badge: "profit" },
  active: { icon: Clock, text: "text-warning", label: "LAUFEND", badge: "warning" },
  pending: { icon: Circle, text: "text-muted-foreground", label: "OFFEN", badge: "muted" },
  blocked: { icon: Lock, text: "text-loss", label: "BLOCKIERT", badge: "loss" },
};

const PHASE_STYLE = {
  DONE: { text: "text-profit", bg: "bg-profit/10", border: "border-profit/20", badge: "profit", label: "ABGESCHLOSSEN" },
  IN_PROGRESS: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20", badge: "warning", label: "LAUFEND" },
  BLOCKED: { text: "text-loss", bg: "bg-loss/10", border: "border-loss/20", badge: "loss", label: "BLOCKIERT" },
};

const PHASE3_AUTO_RUN_KEY = "quantpilot_phase3_auto_run_at";
const PHASE3_AUTO_RUN_COOLDOWN_MS = 15 * 60 * 1000;
const PHASE3_SEQUENCE = [
  { fn: "orderSendSafetyTest", label: "Order-Send Safety Test", payload: {} },
  { fn: "paperExecutionEngine", label: "Paper Execution Engine", payload: {} },
  { fn: "executionReadinessCheck", label: "Execution Readiness Check", payload: {} },
  { fn: "autoOrderPipeline", label: "Auto-Order Pipeline Dry Run", payload: { test_case: "VALID_SIGNAL" } },
];

const FALLBACK_MILESTONES = [
  {
    id: "fallback_1",
    phase: "Phase 1 — Infrastruktur & Daten",
    icon: "Activity",
    status: "IN_PROGRESS",
    target: "Fallback",
    progress: 0.8,
    tasks: [
      { id: "fb_gpt", name: "GPT/OpenAI API Health Check", status: "active", detail: "fetchMilestoneStatus nicht erreichbar" },
      { id: "fb_mexc", name: "MEXC Public Live-Daten", status: "active", detail: "Fallback-Anzeige" },
      { id: "fb_binance", name: "Binance Native API", status: "blocked", detail: "HTTP 451 möglich" },
      { id: "fb_fallback", name: "Binance Fallback via MEXC Mirror", status: "active", detail: "prüfen" },
      { id: "fb_secrets", name: "Server-Secrets ohne Frontend-Exposure", status: "active", detail: "prüfen" },
    ],
  },
  {
    id: "fallback_2",
    phase: "Phase 2 — Strategie-Validierung",
    icon: "Target",
    status: "IN_PROGRESS",
    target: "Fallback",
    progress: 0.4,
    tasks: [
      { id: "fb_a_plus", name: "A+ Setup Definition FROZEN", status: "done" },
      { id: "fb_oos", name: "Phase 4 OOS Validation", status: "active" },
      { id: "fb_stat", name: "Statistical Gate", status: "pending" },
      { id: "fb_wf", name: "Walk-Forward Regression Test", status: "pending" },
      { id: "fb_costs", name: "Fees/Slippage Simulation", status: "pending" },
    ],
  },
  {
    id: "fallback_3",
    phase: "Phase 3 — Execution Readiness",
    icon: "ShieldCheck",
    status: "IN_PROGRESS",
    target: "Fallback",
    progress: 0.2,
    tasks: [
      { id: "fb_paper", name: "Paper Execution Engine", status: "pending" },
      { id: "fb_order", name: "Order-Send Safety Test", status: "pending" },
      { id: "fb_exec", name: "Execution Readiness Check", status: "pending" },
      { id: "fb_recon", name: "Full Reconciliation", status: "pending" },
      { id: "fb_auto", name: "Auto-Order Pipeline Dry Run", status: "pending" },
    ],
  },
  {
    id: "fallback_4",
    phase: "Phase 4 — Go-Live Program (G1–G10)",
    icon: "Zap",
    status: "BLOCKED",
    target: "Revision erforderlich",
    progress: 0.1,
    tasks: [
      { id: "fb_g1", name: "G1: MT5 E2E Hardening", status: "active" },
      { id: "fb_g2", name: "G2: Market Data Integrity", status: "active" },
      { id: "fb_g3", name: "G3: Strategy Frozen", status: "pending" },
      { id: "fb_g5", name: "G5: OOS N=82 erreicht", status: "pending" },
      { id: "fb_gov", name: "Governance & Live Authorization", status: "blocked" },
    ],
  },
];

function normalizeResponse(raw) {
  const data = raw?.data || raw || {};
  const phases = Array.isArray(data.phases) && data.phases.length > 0 ? data.phases : FALLBACK_MILESTONES;
  return { ...data, phases };
}

export default function Meilensteinplan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [phase3Running, setPhase3Running] = useState(false);
  const [phase3Run, setPhase3Run] = useState({
    status: "READY",
    mode: "SAFE_FULL_AUTO_COMPLETION",
    steps: [],
    last_run_at: null,
    message: "Phase-3 Auto-Runner bereit · Live Execution bleibt BLOCKED",
  });

  const load = async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const resp = await base44.functions.invoke("fetchMilestoneStatus", { active_probe: false });
      setData(normalizeResponse(resp));
      setError(null);
    } catch (e) {
      setError(e?.message || "fetchMilestoneStatus unavailable");
      setData((prev) => prev || normalizeResponse({ phases: FALLBACK_MILESTONES, go_live_status: "BLOCKED", live_execution: "BLOCKED" }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const safeLoad = async (opts) => {
      if (!mounted) return;
      await load(opts);
    };
    safeLoad();
    const id = setInterval(() => safeLoad({ silent: true }), 60000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const phases = data?.phases || FALLBACK_MILESTONES;
  const summary = useMemo(() => buildSummary(phases, data?.summary), [phases, data?.summary]);
  const targetOverdue = data?.target_status === "OVERDUE";
  const gptConnected = data?.gpt_api?.status === "CONNECTED";
  const marketFresh = data?.market_data?.market_data_fresh === true;

  return (
    <div className="min-h-full p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Meilensteinplan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            QuantPilot AI – OP-777 · dynamische Task-Übersicht & Go-Live Roadmap
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Ein Backend-Call · 60s Refresh · Active GPT Probe aus · Order Send BLOCKED · Live Execution BLOCKED
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </div>

      {loading ? (
        <PanelCard title="Meilensteinplan lädt">
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
        </PanelCard>
      ) : (
        <>
          <SystemStatusGrid data={data} gptConnected={gptConnected} marketFresh={marketFresh} />

          <div className="mt-4">
            <MilestoneSummary summary={summary} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-4">
              {phases.map((m, i) => <MilestoneCard key={m.id || i} milestone={m} />)}
            </div>
            <div className="space-y-4">
              <BlockersPanel blockers={data?.blockers || []} error={error} />
              <NextActionsPanel actions={data?.next_actions || []} />
              <TargetPanel targetDate={data?.target_date || "2026-09-06"} overdue={targetOverdue} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-warning">Keine Garantie.</span> Trading birgt Risiko des Totalverlusts.
                Die Auto-Vervollständigung bewertet Systemchecks, sie entsperrt niemals Live-Trading.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildSummary(phases, backendSummary) {
  if (backendSummary?.total) return backendSummary;
  const allTasks = phases.flatMap((m) => m.tasks || []);
  const done = allTasks.filter((t) => t.status === "done").length;
  const active = allTasks.filter((t) => t.status === "active").length;
  const pending = allTasks.filter((t) => t.status === "pending").length;
  const blocked = allTasks.filter((t) => t.status === "blocked").length;
  const total = allTasks.length || 1;
  return { total, done, active, pending, blocked, overall_progress: done / total };
}

function SystemStatusGrid({ data, gptConnected, marketFresh }) {
  const binanceNative = data?.market_data?.binance_native || "UNKNOWN";
  const binanceFallback = data?.market_data?.binance_fallback || "OFFLINE";
  const mexc = data?.market_data?.mexc || "UNKNOWN";
  const goLive = data?.go_live_status || "BLOCKED";

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <StatusCard
        icon={gptConnected ? Wifi : WifiOff}
        label="GPT / OpenAI API"
        value={data?.gpt_api?.status || "UNKNOWN"}
        detail={data?.gpt_api?.http_status ? `HTTP ${data.gpt_api.http_status} · ${data.gpt_api.latency_ms || 0}ms` : "serverseitiger Secret-Check"}
        color={gptConnected ? "profit" : "loss"}
      />
      <StatusCard
        icon={marketFresh ? Wifi : WifiOff}
        label="Market Data"
        value={marketFresh ? "FRESH" : "STALE"}
        detail={`MEXC: ${mexc} · Binance Native: ${binanceNative}`}
        color={marketFresh ? "profit" : "loss"}
      />
      <StatusCard
        icon={GitBranch}
        label="GitHub Sync"
        value={data?.github_sync?.status || "MANUAL_CHECK"}
        detail={data?.github_sync?.reason || "Branch-Regel/Berechtigung prüfen"}
        color="warning"
      />
      <StatusCard
        icon={Ban}
        label="Go-Live"
        value={goLive}
        detail={`Live Execution: ${data?.live_execution || "BLOCKED"} · Fallback: ${binanceFallback}`}
        color={goLive?.includes("READY") ? "warning" : "loss"}
      />
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, detail, color }) {
  const map = {
    profit: "border-profit/20 bg-profit/5 text-profit",
    warning: "border-warning/20 bg-warning/5 text-warning",
    loss: "border-loss/20 bg-loss/5 text-loss",
  };
  return (
    <div className={`rounded-lg border p-3 ${map[color] || map.warning}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 font-mono text-sm font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function MilestoneSummary({ summary }) {
  const progress = Math.round((summary.overall_progress || 0) * 100);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryCard icon={CheckCircle2} label="Erledigt" value={summary.done} sub={`von ${summary.total}`} color="profit" />
      <SummaryCard icon={Clock} label="Laufend" value={summary.active} sub="in Bearbeitung" color="warning" />
      <SummaryCard icon={Circle} label="Offen" value={summary.pending} sub="wartet" color="primary" />
      <SummaryCard icon={Lock} label="Blockiert" value={summary.blocked} sub="Live gesperrt" color="loss" />
      <SummaryCard icon={TrendingUp} label="Gesamtfortschritt" value={`${progress}%`} sub={`${summary.done}/${summary.total} Tasks`} color="primary" />
    </div>
  );
}

function MilestoneCard({ milestone }) {
  const style = PHASE_STYLE[milestone.status] || PHASE_STYLE.IN_PROGRESS;
  const PhaseIcon = ICONS[milestone.icon] || Activity;
  const progress = Math.round((milestone.progress || 0) * 100);
  const doneCount = (milestone.tasks || []).filter((t) => t.status === "done").length;
  const totalCount = (milestone.tasks || []).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${style.bg}`}>
            <PhaseIcon className={`h-4 w-4 ${style.text}`} />
          </div>
          <div>
            <h3 className="font-heading text-sm font-semibold text-foreground">{milestone.phase}</h3>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{milestone.target}</p>
          </div>
        </div>
        <StatusBadge status={style.label} color={style.badge} />
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">Fortschritt</span>
          <span className={`font-mono text-xs font-semibold ${style.text}`}>{doneCount}/{totalCount} · {progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="space-y-1.5">
        {(milestone.tasks || []).map((task) => <TaskRow key={task.id || task.name} task={task} />)}
      </div>
    </div>
  );
}

function TaskRow({ task }) {
  const cfg = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
  const Icon = cfg.icon;
  return (
    <div className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.text}`} />
          <span className="truncate text-xs text-foreground">{task.name}</span>
        </div>
        <span className={`shrink-0 font-mono text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
      </div>
      {(task.detail || task.evidence) && (
        <div className="mt-1 pl-5 font-mono text-[10px] text-muted-foreground">
          {task.detail}{task.evidence ? ` · ${task.evidence}` : ""}
        </div>
      )}
    </div>
  );
}

function BlockersPanel({ blockers, error }) {
  return (
    <PanelCard title="Blocker" action={<StatusBadge status={`${blockers.length || 0}`} color={blockers.length ? "loss" : "profit"} />}>
      {error && (
        <div className="mb-2 rounded-md border border-warning/20 bg-warning/5 px-2 py-1.5 text-xs text-warning">
          Fallback aktiv: {error}
        </div>
      )}
      {blockers.length === 0 ? (
        <div className="text-xs text-muted-foreground">Keine dynamischen Blocker gemeldet.</div>
      ) : (
        <div className="space-y-2">
          {blockers.map((b) => (
            <div key={b.id || b.label} className="rounded-md border border-loss/20 bg-loss/5 px-3 py-2">
              <div className="font-mono text-xs font-semibold text-loss">{b.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{b.reason}</div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

function NextActionsPanel({ actions }) {
  return (
    <PanelCard title="Nächste Aktionen">
      {actions.length === 0 ? (
        <div className="text-xs text-muted-foreground">Keine Empfehlungen verfügbar.</div>
      ) : (
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={i} className="flex gap-2 rounded-md border border-border bg-secondary/20 px-3 py-2">
              <span className="font-mono text-xs font-bold text-primary">{i + 1}</span>
              <span className="text-xs text-muted-foreground">{a}</span>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

function TargetPanel({ targetDate, overdue }) {
  return (
    <PanelCard title="Go-Live Ziel" action={<StatusBadge status={overdue ? "ÜBERFÄLLIG" : "OFFEN"} color={overdue ? "loss" : "warning"} />}>
      <div className={`rounded-md border px-3 py-2 ${overdue ? "border-loss/20 bg-loss/5" : "border-primary/20 bg-primary/5"}`}>
        <div className="flex items-center gap-2">
          <Calendar className={`h-4 w-4 ${overdue ? "text-loss" : "text-primary"}`} />
          <span className="font-mono text-xs font-semibold text-foreground">{targetDate}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {overdue
            ? "Zieltermin ist überschritten. Neues Ziel erst nach OOS, Shadow, Reconciliation, GitHub Sync und Governance setzen."
            : "Live-Authorization bleibt blockiert bis alle Gates bestanden sind."}
        </p>
      </div>
    </PanelCard>
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
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${colors[color] || colors.primary}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={`mt-2 font-mono text-xl font-bold ${(colors[color] || colors.primary).split(" ")[0]}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
