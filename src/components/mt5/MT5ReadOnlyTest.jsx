import React from "react";
import { Clock, Lock } from "lucide-react";
import { readOnlyTestResults } from "@/lib/mt5Data";

// Ehrlich: der Read-only-Test ist NICHT durchgeführt, solange keine Bridge läuft.
// Frühere „BESTANDEN"-Anzeige war irreführend und wurde entfernt.
export default function MT5ReadOnlyTest() {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Read-Only Connection Test</span>
        <span className="font-mono text-xs font-semibold text-warning">NICHT DURCHGEFÜHRT</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {readOnlyTestResults.map((r) => (
          <div key={r.key} className="flex items-center gap-1.5 rounded border border-border bg-background/40 px-2 py-1.5 opacity-70">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{r.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5 rounded border border-loss/30 bg-loss/10 px-2 py-1.5 glow-red">
        <Lock className="h-3.5 w-3.5 shrink-0 text-loss" />
        <span className="text-xs font-semibold text-loss">Live Execution – BLOCKED</span>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Test muss auf dem MT5-Rechner gegen die FastAPI-Bridge laufen. Erst wenn alle Prüfungen
        <span className="font-semibold text-foreground"> pass</span> melden, darf der Status auf
        <span className="font-mono text-profit"> MT5_E2E_CONNECTED</span> wechseln.
      </p>
    </div>
  );
}