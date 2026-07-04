import React, { useState } from "react";
import { Lock, ShieldCheck, XCircle, Clock, ShieldAlert } from "lucide-react";
import {
  pendingGovernance, governanceActionLabels, auditLogs,
} from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function Governance() {
  const [actions, setActions] = useState(pendingGovernance);
  const [pin, setPin] = useState("");

  const handleApprove = (id) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: "APPROVED" } : a)));
  };
  const handleReject = (id) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: "REJECTED" } : a)));
  };

  const governanceAudit = auditLogs.filter((l) => l.category === "GOVERNANCE");
  const allActionTypes = Object.entries(governanceActionLabels);

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Lock className="h-6 w-6 text-warning" />
          Governance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">ULF Governance Engine – Live-Trading ist standardmäßig deaktiviert</p>
      </div>

      {/* Warning Banner */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 glow-red">
        <ShieldAlert className="h-5 w-5 text-loss shrink-0" />
        <p className="text-sm text-loss">
          <span className="font-semibold">Achtung:</span> Alle Aktionen mit erhöhtem Risiko benötigen eine explizite Governance-Freigabe.
          Ohne Freigabe bleibt das System im Paper/Shadow-Modus.
        </p>
      </div>

      {/* Pending Actions */}
      <PanelCard title={`Pending Actions (${actions.filter((a) => a.status === "PENDING").length})`}>
        <div className="space-y-4">
          {actions.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10">
                    <Lock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-semibold">{governanceActionLabels[a.action_type]}</span>
                      <StatusBadge status={a.status} color={a.status === "PENDING" ? "warning" : a.status === "APPROVED" ? "profit" : "loss"} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(a.request_date).toLocaleString("de-DE")}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-foreground">{a.reason}</p>
              <div className="mt-2 rounded-md bg-background/50 p-2 font-mono text-xs text-muted-foreground">{a.details}</div>

              {a.status === "PENDING" && (
                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="PIN (6-stellig)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-32 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => handleApprove(a.id)}
                    disabled={pin.length < 4}
                    className="flex items-center gap-2 rounded-md bg-profit/15 border border-profit/30 px-4 py-2 text-sm font-semibold text-profit hover:bg-profit/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Freigeben
                  </button>
                  <button
                    onClick={() => handleReject(a.id)}
                    className="flex items-center gap-2 rounded-md border border-loss/30 bg-loss/10 px-4 py-2 text-sm font-semibold text-loss hover:bg-loss/20"
                  >
                    <XCircle className="h-4 w-4" />
                    Ablehnen
                  </button>
                </div>
              )}
              {a.status === "APPROVED" && (
                <div className="mt-3 flex items-center gap-2 text-sm text-profit">
                  <ShieldCheck className="h-4 w-4" /> Freigegeben – Audit Log aktualisiert
                </div>
              )}
              {a.status === "REJECTED" && (
                <div className="mt-3 flex items-center gap-2 text-sm text-loss">
                  <XCircle className="h-4 w-4" /> Abgelehnt – Aktion bleibt gesperrt
                </div>
              )}
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Governance Action Types */}
      <PanelCard title="Freigabepflichtige Aktionen" className="mt-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {allActionTypes.map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
              <Lock className="h-3.5 w-3.5 text-warning shrink-0" />
              <span className="text-xs text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Audit Log */}
      <PanelCard title="Governance Audit Log" className="mt-4">
        <div className="space-y-2">
          {governanceAudit.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
              <StatusBadge status={log.severity} color={log.severity === "WARNING" ? "warning" : "loss"} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{log.action}</span>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(log.created_date).toLocaleString("de-DE")}</span>
                </div>
                <p className="mt-0.5 text-sm text-foreground">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}