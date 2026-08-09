import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { eaArmGates, canArmEA } from "@/lib/mt5Data";

export default function MT5GateMatrix({ connection, gates }) {
  const armable = canArmEA(connection, gates);

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">EA Arm-Gates</span>
        <span className={`font-mono text-xs font-semibold ${armable ? "text-profit" : "text-loss"}`}>
          {armable ? "ARMED READY" : "BLOCKED"}
        </span>
      </div>

      <div className="space-y-1.5">
        {eaArmGates.map((g) => {
          const ok = !!gates[g.key];
          return (
            <div key={g.key} className="flex items-start gap-2 rounded border border-border bg-background/40 px-2.5 py-1.5">
              {ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-loss" />}
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">{g.label}</div>
                <div className="text-[11px] text-muted-foreground">{g.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}