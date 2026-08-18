import React, { memo } from "react";
import { HeartPulse, AlertTriangle, XCircle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

// 4-State Heartbeat-Klassifikation:
//   EA_NOT_RUNNING           – EA nie gepostet (Bridge _last_heartbeat = None)
//   EA_HEARTBEAT_NOT_RECEIVED – Bridge oben, aber /heartbeat nie aufgerufen
//   HEARTBEAT_STALE           – EA gepostet, aber Timeout überschritten
//   HEARTBEAT_HEALTHY         – EA postet innerhalb des healthy-Fensters
//
// Keine Default-PASS-Werte. Die Reason kommt ausschließlich aus der Bridge-Antwort.
// POST-Metriken (section 8): GET verdeckt keine POST-Fehler.

const STATES = {
  HEARTBEAT_HEALTHY: {
    label: "HEARTBEAT_HEALTHY",
    color: "profit",
    icon: CheckCircle2,
    desc: "EA postet innerhalb des healthy-Fensters (< 10s).",
  },
  EA_NOT_RUNNING: {
    label: "EA_NOT_RUNNING",
    color: "loss",
    icon: XCircle,
    desc: "Kein EA-Heartbeat je empfangen. Bridge _last_heartbeat = None.",
  },
  EA_HEARTBEAT_NOT_RECEIVED: {
    label: "EA_HEARTBEAT_NOT_RECEIVED",
    color: "loss",
    icon: XCircle,
    desc: "Bridge erreichbar, aber /heartbeat nie vom EA aufgerufen.",
  },
  HEARTBEAT_STALE: {
    label: "HEARTBEAT_STALE",
    color: "warning",
    icon: AlertTriangle,
    desc: "EA hat gepostet, aber Heartbeat-Timeout überschritten (> 30s).",
  },
};

function StateRow({ stateKey, count, total, isCurrent }) {
  const meta = STATES[stateKey] || STATES.EA_NOT_RUNNING;
  const Icon = meta.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const tone = {
    profit: "text-profit border-profit/30 bg-profit/10",
    loss: "text-loss border-loss/30 bg-loss/10",
    warning: "text-warning border-warning/30 bg-warning/10",
  }[meta.color];
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${tone} ${isCurrent ? "glow-cyan ring-1 ring-primary/40" : "opacity-80"}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold">{meta.label}</span>
          {isCurrent && <span className="text-[10px] font-bold text-primary">CURRENT</span>}
        </div>
        <div className="text-[10px] text-muted-foreground">{meta.desc}</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[10px] tabular-nums">{count}/{total} ({pct}%)</span>
        </div>
      </div>
    </div>
  );
}

function PostMetric({ label, value, tone = "default" }) {
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
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function MT5HeartbeatDiagnostic({ reasons, currentReason, heartbeatAgeS, postMetrics }) {
  const total = Object.values(reasons).reduce((a, b) => a + b, 0);
  const order = ["HEARTBEAT_HEALTHY", "EA_NOT_RUNNING", "EA_HEARTBEAT_NOT_RECEIVED", "HEARTBEAT_STALE"];

  const pm = postMetrics || {};
  const failureRatePct = typeof pm.failure_rate === "number"
    ? Math.round(pm.failure_rate * 100)
    : 0;
  const hasFailures = (pm.post_failures || 0) > 0;
  const hasConsecutive = (pm.consecutive_failures || 0) > 0;

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-primary" />
        <span className="font-heading text-sm font-semibold text-foreground">Heartbeat-Path Diagnose</span>
        {heartbeatAgeS != null && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            last_heartbeat_age: <span className="text-foreground">{heartbeatAgeS.toFixed(1)}s</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {order.map((k) => (
          <StateRow
            key={k}
            stateKey={k}
            count={reasons[k] || 0}
            total={total}
            isCurrent={currentReason === k}
          />
        ))}
      </div>

      {/* POST Monitoring (section 8) */}
      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2">
          {hasFailures ? (
            <TrendingDown className="h-3.5 w-3.5 text-loss" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5 text-profit" />
          )}
          <span className="font-heading text-xs font-semibold text-foreground">POST Monitoring</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            GET verdeckt keine POST-Fehler
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <PostMetric label="post_success" value={String(pm.post_success ?? 0)} tone="fresh" />
          <PostMetric label="post_failures" value={String(pm.post_failures ?? 0)} tone={hasFailures ? "stale" : "fresh"} />
          <PostMetric label="failure_rate" value={`${failureRatePct}%`} tone={failureRatePct > 5 ? "stale" : failureRatePct > 0 ? "warn" : "fresh"} />
          <PostMetric label="consecutive_failures" value={String(pm.consecutive_failures ?? 0)} tone={hasConsecutive ? "stale" : "fresh"} />
          <PostMetric label="last_success_at" value={fmtTime(pm.last_success_at)} tone="cyan" />
          <PostMetric label="last_failure_at" value={fmtTime(pm.last_failure_at)} tone={pm.last_failure_at ? "warn" : "default"} />
        </div>
        {hasFailures && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-loss/30 bg-loss/10 px-2 py-1.5 text-[10px] text-loss">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              {pm.post_failures} POST-Fehler erkannt (Gap-basiert inferiert).
              Root-Cause: Threadpool-Erschöpfung durch blockierende MT5-Calls.
              Fix: Heartbeat-Endpunkte sind jetzt async (Event-Loop, kein Threadpool-Wait).
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Pfad: <span className="font-mono">MT5/EA → Bridge /heartbeat → QuantPilot → TICK_MONITOR</span>.
        Reason aus <span className="font-mono">heartbeat.reason</span> (Bridge). Kein Default-PASS.
      </p>
    </div>
  );
}

export default memo(MT5HeartbeatDiagnostic);