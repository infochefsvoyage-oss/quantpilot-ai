import React from "react";
import { Unplug, ShieldAlert } from "lucide-react";

// Ehrlicher Live-Verbindungs-Check.
// Dieses Base44-Frontend kann KEINE echte MT5-Verbindung herstellen.
// Bridge + Terminal sind extern. Die hier gezeigten Status bilden einen
// gemeldeten Read-only-Test ab – keine verifizierte E2E-Verbindung aus dieser App.

const targetRows = [
  { label: "Vantage MT5", value: "CONNECTED", tone: "ok" },
  { label: "Account", value: "SYNCED", tone: "ok" },
  { label: "XAUUSD", value: "VALIDATED", tone: "ok" },
  { label: "Market Data", value: "AVAILABLE", tone: "ok" },
  { label: "EA Heartbeat", value: "HEALTHY", tone: "ok" },
  { label: "Execution", value: "🔒 BLOCKED", tone: "warn" },
  { label: "Risk Gate", value: "NOT ARMED", tone: "warn" },
  { label: "Governance", value: "NOT ARMED", tone: "warn" },
  { label: "Live Trading", value: "DISABLED", tone: "warn" },
];

const toneClass = {
  ok: "text-profit",
  warn: "text-warning",
};

export default function MT5BridgeLiveCheck() {
  return (
    <div className="rounded-md border border-loss/40 bg-loss/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Unplug className="h-4 w-4 shrink-0 text-loss" />
        <span className="text-sm font-semibold text-loss">Keine echte End-to-End-Verbindung</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Dieses Frontend spricht <span className="font-semibold text-foreground">niemals direkt mit MT5</span>.
        Die FastAPI-Bridge (<span className="font-mono">mt5_bridge.py</span>) und das MT5-Terminal sind extern
        und noch <span className="font-semibold text-loss">nicht angebunden</span>. Die angezeigten Status
        (DATA_ONLY, LOGGED_IN, EA CONNECTED) bilden einen vom Backend gemeldeten Read-only-Test ab –
        <span className="font-semibold text-foreground"> keine verifizierte Live-Verbindung aus dieser App</span>.
      </p>

      <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-warning" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Zielzustand (Vertrag definiert – nicht live)
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {targetRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className={`font-mono text-xs font-semibold ${toneClass[r.tone]}`}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Nächster Schritt: <span className="font-mono">mt5_bridge.py</span> + Pydantic-Schemas im externen Repo
        implementieren, dann Bridge gegen laufendes MT5-Terminal testen – ohne eine echte Order.
      </p>
    </div>
  );
}