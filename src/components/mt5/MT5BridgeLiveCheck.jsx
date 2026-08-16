import React from "react";
import { Unplug, ShieldAlert, CheckCircle2, HelpCircle, XCircle, Lock, Loader2 } from "lucide-react";
import { verificationTiers, verificationSteps, e2eTestChecks } from "@/lib/mt5Data";

// Ehrlicher Live-Verbindungs-Check (v1.2).
// Trennt strikt: CURRENT VERIFICATION (Ist) vs. TARGET (Ziel).
// Tier wird aus der MT5Connection-Entity abgeleitet (Prop connection.verification_tier).
// Fallback: UI_CONTRACT – keine Bridge, kein Terminal, kein E2E-Beweis.

const stepIcon = { verified: CheckCircle2, unknown: HelpCircle, not_verified: XCircle, failed: XCircle };
const stepColor = { verified: "text-profit", unknown: "text-muted-foreground", not_verified: "text-loss", failed: "text-loss" };

// Mappt den Verification-Tier auf die Step-States.
// MT5_E2E_CONNECTED -> alle verified; sonst bleibt die Default-Map (unknown/not_verified).
function deriveStepStates(tierKey) {
  if (tierKey === "MT5_E2E_CONNECTED") {
    return {
      ui_contract: "verified",
      backend_bridge: "verified",
      mt5_terminal: "verified",
      vantage_account: "verified",
      xauusd: "verified",
      market_data: "verified",
      ea_heartbeat: "verified",
      e2e: "verified",
    };
  }
  if (tierKey === "BACKEND_CONNECTED") {
    return {
      ui_contract: "verified",
      backend_bridge: "verified",
      e2e: "not_verified",
    };
  }
  return {};
}

export default function MT5BridgeLiveCheck({ connection, loading = false }) {
  const tierKey = connection?.verification_tier ?? "UI_CONTRACT";
  const tier = verificationTiers[tierKey] ?? verificationTiers.UI_CONTRACT;
  const isE2E = tierKey === "MT5_E2E_CONNECTED";
  const stepOverrides = deriveStepStates(tierKey);

  const rootClass = isE2E
    ? "rounded-md border border-profit/40 bg-profit/5 p-3"
    : "rounded-md border border-loss/40 bg-loss/5 p-3";
  const rootText = isE2E ? "text-profit" : "text-loss";
  const RootIcon = isE2E ? CheckCircle2 : Unplug;
  const rootTitle = isE2E ? "End-to-End-Verbindung bewiesen" : "Keine echte End-to-End-Verbindung";

  return (
    <div className={rootClass}>
      <div className="mb-2 flex items-center gap-2">
        <RootIcon className={`h-4 w-4 shrink-0 ${rootText}`} />
        <span className={`text-sm font-semibold ${rootText}`}>{rootTitle}</span>
        <span className={`ml-auto font-mono text-xs font-semibold ${rootText}`}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tier.label}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Frontend spricht niemals direkt mit MT5. Bridge + Terminal sind extern.
        Aktueller Zustand: <span className={`font-mono ${rootText}`}>{tier.label}</span> – {tier.desc}
      </p>

      {/* CURRENT VERIFICATION – Ist-Zustand */}
      <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-warning" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current Verification</span>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {verificationSteps.map((s) => {
            const state = stepOverrides[s.key] ?? s.state;
            const Icon = stepIcon[state];
            return (
              <div key={s.key} className="flex items-center gap-1.5 rounded border border-border bg-secondary/30 px-2 py-1">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${stepColor[state]}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                  {state === "verified" ? "✓" : state === "not_verified" ? "❌" : state === "failed" ? "❌" : "?"}
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
            <span className={`font-mono text-[10px] ${isE2E ? "text-profit" : "text-muted-foreground"}`}>
              {isE2E ? "✓" : "—"}
            </span>
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
              <span className={`ml-auto font-mono text-[10px] uppercase ${isE2E ? "text-profit" : "text-muted-foreground"}`}>
                {isE2E ? "pass" : c.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Statusquelle: <span className="font-mono">MT5Connection</span>-Entity (DB). Tier =
        <span className={`font-mono ${rootText}`}> {tier.label}</span>. Live-Execution bleibt
        <span className="font-semibold text-loss"> BLOCKED</span>. Bridge-Code &amp; Testprozedur:
        <span className="font-mono"> quantpilot-mt5-bridge/</span>.
      </p>
    </div>
  );
}