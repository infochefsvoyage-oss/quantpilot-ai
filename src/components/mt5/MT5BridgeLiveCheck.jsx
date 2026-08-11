import React from "react";
import { Unplug, ShieldAlert, CheckCircle2, Clock, XCircle } from "lucide-react";
import { verificationTiers, e2eTestChecks } from "@/lib/mt5Data";

// Ehrlicher Live-Verbindungs-Check.
// Drei Stufen: UI_CONTRACT | BACKEND_CONNECTED | MT5_E2E_CONNECTED
// Aktuell: UI_CONTRACT – keine Bridge, kein Terminal, kein E2E-Beweis.

const tier = verificationTiers.UI_CONTRACT;
const checkIcon = { pass: CheckCircle2, fail: XCircle, pending: Clock };
const checkColor = { pass: "text-profit", fail: "text-loss", pending: "text-muted-foreground" };

export default function MT5BridgeLiveCheck() {
  return (
    <div className="rounded-md border border-loss/40 bg-loss/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Unplug className="h-4 w-4 shrink-0 text-loss" />
        <span className="text-sm font-semibold text-loss">Keine echte End-to-End-Verbindung</span>
        <span className="ml-auto font-mono text-xs font-semibold text-loss">{tier.label}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Dieses Frontend spricht <span className="font-semibold text-foreground">niemals direkt mit MT5</span>.
        Die FastAPI-Bridge (<span className="font-mono">mt5_bridge.py</span>) und das MT5-Terminal sind extern
        und noch <span className="font-semibold text-loss">nicht angebunden</span>. Aktueller Zustand:
        <span className="font-mono text-loss"> {tier.label}</span> – {tier.desc}
      </p>

      {/* Drei-Stufen-Modell */}
      <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-3">
        {Object.values(verificationTiers).map((t) => (
          <div
            key={t.label}
            className={`rounded border px-2 py-1.5 ${
              t.label === tier.label ? "border-loss/50 bg-loss/10" : "border-border bg-secondary/30 opacity-60"
            }`}
          >
            <div className={`font-mono text-xs font-semibold ${t.label === tier.label ? "text-loss" : "text-muted-foreground"}`}>
              {t.label}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {t.label === "MT5_E2E_CONNECTED" ? "eindeutig echte Verbindung" : t.label === "BACKEND_CONNECTED" ? "Bridge läuft, Terminal offen" : "nur Vertrag/UI"}
            </div>
          </div>
        ))}
      </div>

      {/* E2E-Test-Checkliste */}
      <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-warning" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            E2E-Live-Test (auf MT5-Rechner auszuführen)
          </span>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {e2eTestChecks.map((c) => {
            const Icon = checkIcon[c.status];
            return (
              <div key={c.key} className="flex items-center gap-1.5 rounded border border-border bg-secondary/30 px-2 py-1">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${checkColor[c.status]}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">{c.status}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Health-/Connection-Log existiert <span className="font-semibold text-loss">noch nicht</span> – es gibt keine laufende Bridge in dieser App.
        Testprozedur siehe <span className="font-mono">MT5_E2E_TEST_PROCEDURE.md</span>.
      </p>
    </div>
  );
}