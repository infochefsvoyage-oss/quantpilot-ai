import React, { memo } from "react";
import { HeartPulse, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

// 4-State Heartbeat-Klassifikation:
//   EA_NOT_RUNNING           – EA nie gepostet (Bridge _last_heartbeat = None)
//   EA_HEARTBEAT_NOT_RECEIVED – Bridge oben, aber /heartbeat nie aufgerufen
//   HEARTBEAT_STALE           – EA gepostet, aber Timeout überschritten
//   HEARTBEAT_HEALTHY         – EA postet innerhalb des healthy-Fensters
//
// Keine Default-PASS-Werte. Die Reason kommt ausschließlich aus der Bridge-Antwort.

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

function MT5HeartbeatDiagnostic({ reasons, currentReason, heartbeatAgeS }) {
  const total = Object.values(reasons).reduce((a, b) => a + b, 0);
  const order = ["HEARTBEAT_HEALTHY", "EA_NOT_RUNNING", "EA_HEARTBEAT_NOT_RECEIVED", "HEARTBEAT_STALE"];
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
      <p className="mt-2 text-[10px] text-muted-foreground">
        Pfad: <span className="font-mono">MT5/EA → Bridge /heartbeat → QuantPilot → TICK_MONITOR</span>.
        Reason aus <span className="font-mono">heartbeat.reason</span> (Bridge). Kein Default-PASS.
      </p>
    </div>
  );
}

export default memo(MT5HeartbeatDiagnostic);