import React from "react";
import { CheckCircle2, XCircle, ShieldX } from "lucide-react";
import { ICT_HARD_GATES, evaluateHardGates } from "@/lib/ictData";

export default function ICTGateMatrix({ signal }) {
  const gates = evaluateHardGates(signal);
  const passed = Object.values(gates).filter(Boolean).length;
  const total = Object.keys(gates).length;
  const allPass = passed === total;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldX className="h-4 w-4 text-loss" />
          <span className="font-heading text-sm font-semibold text-foreground">Hard Gates</span>
        </div>
        <div className={`font-mono text-xs font-bold ${allPass ? "text-profit" : "text-loss"}`}>
          {passed}/{total} {allPass ? "✓ ALL PASS" : "✗ BLOCKED"}
        </div>
      </div>

      <div className="space-y-1.5">
        {ICT_HARD_GATES.map((gate) => {
          const passed = gates[gate.key];
          return (
            <div
              key={gate.key}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                passed ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"
              }`}
            >
              <span className="text-xs text-foreground">{gate.label}</span>
              {passed ? (
                <CheckCircle2 className="h-4 w-4 text-profit" />
              ) : (
                <XCircle className="h-4 w-4 text-loss" />
              )}
            </div>
          );
        })}
      </div>

      {!allPass && (
        <div className="mt-3 rounded-md border border-loss/20 bg-loss/5 px-3 py-2">
          <p className="text-xs text-loss font-semibold">
            ⛔ Hard Gate FAIL → NO TRADE (Score kann Gate nicht überstimmen)
          </p>
        </div>
      )}
    </div>
  );
}