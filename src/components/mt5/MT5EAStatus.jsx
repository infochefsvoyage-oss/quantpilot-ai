import React from "react";
import { Lock, Activity } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { eaStatusMeta } from "@/lib/mt5Data";

export default function MT5EAStatus({ connection }) {
  const meta = eaStatusMeta[connection.ea_status] ?? eaStatusMeta.NOT_INSTALLED;

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Expert Advisor</span>
        </div>
        <StatusBadge status={meta.label} color={meta.color} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Field label="EA Enabled" value={connection.ea_enabled ? "TRUE" : "FALSE"} danger={!connection.ea_enabled} />
        <Field label="Magic Number" value={connection.magic_number} />
        <Field label="Letzter Heartbeat" value={fmt(connection.last_heartbeat)} />
        <Field label="Heartbeat-Timeout" value={`${connection.heartbeat_timeout_seconds}s`} />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded border border-warning/20 bg-warning/5 px-2 py-1.5">
        <Lock className="h-3 w-3 text-warning" />
        <span className="text-[11px] text-muted-foreground">
          EA darf keine Strategie selbst ändern. Strategie kommt aus QuantPilot.
        </span>
      </div>
    </div>
  );
}

function Field({ label, value, danger = false }) {
  return (
    <div className="rounded border border-border bg-background/40 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono font-semibold ${danger ? "text-loss" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("de-DE");
  } catch {
    return "—";
  }
}