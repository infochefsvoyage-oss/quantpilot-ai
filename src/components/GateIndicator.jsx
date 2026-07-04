import React from "react";

export default function GateIndicator({ label, passed }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${passed ? "bg-profit" : "bg-loss"}`} />
        <span className={`font-mono text-xs font-semibold ${passed ? "text-profit" : "text-loss"}`}>
          {passed ? "PASS" : "FAIL"}
        </span>
      </div>
    </div>
  );
}