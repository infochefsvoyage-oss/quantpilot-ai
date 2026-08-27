import React from "react";

/** @param {{status?: any, color?: string, className?: string}} props */
export default function StatusBadge({ status = "—", color = "muted", className = "" }) {
  const colors = {
    profit: "bg-profit/10 text-profit border-profit/30",
    loss: "bg-loss/10 text-loss border-loss/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    cyan: "bg-primary/10 text-primary border-primary/30",
    muted: "bg-secondary text-secondary-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-semibold ${colors[color]} ${className}`}>
      {status}
    </span>
  );
}