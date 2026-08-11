import React from "react";
import { Unplug, ShieldAlert, CheckCircle2, HelpCircle, XCircle, Lock } from "lucide-react";
import { verificationTiers, verificationSteps, e2eTestChecks } from "@/lib/mt5Data";

// Ehrlicher Live-Verbindungs-Check (v1.2).
// Trennt strikt: CURRENT VERIFICATION (Ist) vs. TARGET (Ziel).
// Aktuell: UI_CONTRACT – keine Bridge, kein Terminal, kein E2E-Beweis.

const tier = verificationTiers.UI_CONTRACT;
const stepIcon = { verified: CheckCircle2, unknown: HelpCircle, not_verified: XCircle, failed: XCircle };
const stepColor = { verified: "text-profit", unknown: "text-muted-foreground", not_verified: "text-loss", failed: "text-loss" };

export default function MT5BridgeLiveCheck() {
  return (
    <div className="rounded-md border border-loss/40 bg-loss/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Unplug className="h-4 w-4 shrink-0 text-loss" />
        <span className="text-sm font-semibold text-loss">Keine echte End-to-End-Verbindung</span>
        <span className="ml-auto font-mono text-xs font-semibold text-loss">{tier.label}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Frontend spricht niemals direkt mit MT5. Bridge + Terminal sind extern und nicht angebunden.
        Aktueller Zustand: <span className="font-mono text-loss">{tier.label}</span> – {tier.desc}
      </p>

      {/* CURRENT VERIFICATION – Ist-Zustand */}
      <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-warning" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current Verification</span>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {verificationSteps.map((s) => {
            const Icon = stepIcon[s.state];
            return (
              <div key={s.key} className="flex items-center gap-1.5 rounded border border-border bg-secondary/30 px-2 py-1">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${stepColor[s.state]}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                  {s.state === "verified" ? "✓" : s.state === "not_verified" ? "❌" : s.state === "failed" ? "❌" : "?"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TARGET – Zielzustand */}
      <div className="mt-2 rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target</span>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-xs text-muted-foreground">MT5_E2E_CONNECTED</span>
            <span className="font-mono text-[10px] text-muted-foreground">—</span>
          </div>
          <div className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-xs text-muted-foreground">Execution</span>
            <span className="font-mono text-xs font-semibold text-loss">🔒 BLOCKED</span>
          </div>
          <div className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1">
            <span className="text-xs text-muted-foreground">Live Trading</span>
            <span className="font-mono text-xs font-semibold text-loss">DISABLED</span>
          </div>
        </div>
      </div>

      {/* E2E-Test-Checkliste (12) */}
      <div className="mt-2 rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          E2E-Live-Test (12 Prüfungen – auf MT5-Rechner auszuführen)
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {e2eTestChecks.map((c) => (
            <div key={c.key} className="flex items-center gap-1.5 rounded border border-border bg-secondary/30 px-2 py-1">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">{c.status}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Health-/Connection-Log existiert <span className="font-semibold text-loss">noch nicht</span> – keine laufende Bridge.
        Bridge-Code &amp; Testprozedur: <span className="font-mono">quantpilot-mt5-bridge/</span> und
        <span className="font-mono"> MT5_E2E_TEST_PROCEDURE.md</span>.
      </p>
    </div>
  );
}