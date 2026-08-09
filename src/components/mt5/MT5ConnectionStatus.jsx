import React from "react";
import StatusBadge from "@/components/StatusBadge";
import { connectionStatusMeta } from "@/lib/mt5Data";

export default function MT5ConnectionStatus({ connection }) {
  const meta = connectionStatusMeta[connection.connection_status] ?? connectionStatusMeta.DISCONNECTED;

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Broker / Plattform</div>
          <div className="mt-1 font-mono text-sm font-semibold text-foreground">
            {connection.broker} · {connection.platform}
          </div>
        </div>
        <StatusBadge status={meta.label} color={meta.color} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Field label="Integration" value={connection.integration} />
        <Field label="Execution Mode" value={connection.execution_mode} />
        <Field label="Account-ID" value={connection.account_id || "—"} />
        <Field label="Server" value={connection.server || "—"} />
        <Field label="Login-Status" value={connection.login_status} />
        <Field label="Live-Execution" value={connection.live_execution_blocked ? "BLOCKED" : "OFFEN"} danger={connection.live_execution_blocked} />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">{meta.desc}</p>
    </div>
  );
}

function Field({ label, value, danger }) {
  return (
    <div className="rounded border border-border bg-background/40 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono font-semibold ${danger ? "text-loss" : "text-foreground"}`}>{value}</div>
    </div>
  );
}