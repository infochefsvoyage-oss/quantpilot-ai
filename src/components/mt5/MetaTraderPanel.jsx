import React from "react";
import { Lock, ShieldAlert, Bot, Server } from "lucide-react";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import { defaultMT5Connection, defaultGateState, isLiveBlocked } from "@/lib/mt5Data";
import MT5ConnectionStatus from "./MT5ConnectionStatus";
import MT5EAStatus from "./MT5EAStatus";
import MT5SymbolMapping from "./MT5SymbolMapping";
import MT5GateMatrix from "./MT5GateMatrix";
import MT5ReadOnlyTest from "./MT5ReadOnlyTest";

export default function MetaTraderPanel({ className = "" }) {
  const connection = defaultMT5Connection;
  const gates = defaultGateState;
  const liveBlocked = isLiveBlocked(connection);

  return (
    <div className={className}>
      <PanelCard
        title="Vantage / MetaTrader 5 Integration"
        action={
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <StatusBadge status="BROKER-PLATTFORM" color="cyan" />
          </div>
        }
      >
        {/* Architektur-Hinweis */}
        <div className="mb-3 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">Vantage (Broker) → MT5 (Plattform) → EA (Adapter) → QuantPilot (Strategie).</span>{" "}
            MT5 ist keine Exchange. Strategie, Risk und Governance bleiben bei QuantPilot.
          </p>
        </div>

        {/* Security */}
        <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 glow-amber">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-muted-foreground">
            Keine Zugangsdaten im Frontend. MT5-Login/Passwort ausschließlich über sichere Backend-/Environment-Konfiguration.
            Account-ID und Server werden nur referenziert, niemals Credentials im React-Code.
          </p>
        </div>

        {/* Status + EA */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <MT5ConnectionStatus connection={connection} />
          <MT5EAStatus connection={connection} />
        </div>

        {/* Read-Only Test */}
        <div className="mt-3">
          <MT5ReadOnlyTest />
        </div>

        {/* Gates + Symbol Mapping */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <MT5GateMatrix connection={connection} gates={gates} />
          <MT5SymbolMapping />
        </div>

        {/* Live-Block */}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-loss/30 bg-loss/10 px-3 py-2 glow-red">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
          <div className="text-xs">
            <p className="font-semibold text-loss">Live-Execution BLOCKED</p>
            <p className="mt-0.5 text-muted-foreground">
              Default: execution_mode=PAPER, ea_enabled=false, live_execution_blocked=true.
              Freigabe erst nach MT5 Read-only-Test, Symbol-Mapping-Validierung, EA-Heartbeat-Stabilität,
              Paper-Trading und 24h Shadow-Test.
            </p>
          </div>
        </div>

        {/* Aktionen – alle gesperrt */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground opacity-60"
          >
            <Server className="h-3.5 w-3.5" />
            Read-only Test (Backend)
          </button>
          <button
            disabled
            className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning opacity-60"
          >
            <Lock className="h-3.5 w-3.5" />
            EA Arm (Gates offen)
          </button>
          <button
            disabled
            className="flex items-center gap-1.5 rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm font-semibold text-loss opacity-60"
          >
            <Lock className="h-3.5 w-3.5" />
            Live (gesperrt)
          </button>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Platzhalter-Status – wartet auf FastAPI/MT5-Bridge. Keine Mock-Daten als Live-Daten.
        </p>
      </PanelCard>
    </div>
  );
}