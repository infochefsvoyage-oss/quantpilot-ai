import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { evaluateHardGates, evaluateDecision, DECISION_CONFIG } from "@/lib/ictData";
import StatusBadge from "@/components/StatusBadge";

export default function ICTSignalCard({ signal, active, onSelect }) {
  const gates = evaluateHardGates(signal);
  const passedGates = Object.values(gates).filter(Boolean).length;
  const totalGates = Object.keys(gates).length;
  const decision = evaluateDecision(signal);
  const dc = DECISION_CONFIG[decision];

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        active ? "border-primary bg-primary/5 glow-cyan" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {signal.side === "LONG" ? (
            <TrendingUp className="h-4 w-4 text-profit" />
          ) : (
            <TrendingDown className="h-4 w-4 text-loss" />
          )}
          <span className="font-mono text-sm font-bold text-foreground">{signal.symbol}</span>
          <span className={`font-mono text-xs ${signal.side === "LONG" ? "text-profit" : "text-loss"}`}>
            {signal.side}
          </span>
        </div>
        <StatusBadge status={dc.label} color={dc.color} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>ICT: <span className={`font-bold ${signal.ict_score >= 70 ? "text-profit" : signal.ict_score >= 50 ? "text-warning" : "text-loss"}`}>{signal.ict_score}</span></span>
          <span>CRV: <span className="font-bold text-foreground">{signal.crv?.toFixed(1) ?? "—"}</span></span>
          <span>KZ: <span className="font-bold text-foreground">{signal.killzone}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`font-mono text-[10px] font-bold ${passedGates === totalGates ? "text-profit" : "text-loss"}`}>
            {passedGates}/{totalGates}
          </span>
        </div>
      </div>

      <div className="mt-2 flex gap-0.5">
        {Object.values(gates).map((g, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${g ? "bg-profit" : "bg-loss/40"}`} />
        ))}
      </div>
    </button>
  );
}