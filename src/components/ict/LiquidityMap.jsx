import React from "react";
import { Droplets } from "lucide-react";

export default function LiquidityMap({ signal }) {
  const levels = [
    { label: "PDH", value: signal.pdh, type: "resistance" },
    { label: "PWH", value: signal.pwh, type: "resistance" },
    { label: "London High", value: signal.london_high, type: "resistance" },
    { label: "Asia High", value: signal.asia_high, type: "resistance" },
    { label: "Asia Low", value: signal.asia_low, type: "support" },
    { label: "London Low", value: signal.london_low, type: "support" },
    { label: "PDL", value: signal.pdl, type: "support" },
    { label: "PWL", value: signal.pwl, type: "support" },
  ].filter((l) => l.value != null);

  const swept = signal.liquidity_pool_type;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Droplets className="h-4 w-4 text-primary" />
        <span className="font-heading text-sm font-semibold text-foreground">Liquidity Map</span>
        {signal.equal_highs && <span className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] text-warning">EQH</span>}
        {signal.equal_lows && <span className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] text-warning">EQL</span>}
      </div>

      <div className="space-y-1">
        {levels.map((lvl) => {
          const isSwept = swept === lvl.label.replace(" ", "_").toUpperCase()
            || (swept === "EQUAL_HIGHS" && lvl.type === "resistance" && signal.equal_highs)
            || (swept === "EQUAL_LOWS" && lvl.type === "support" && signal.equal_lows);
          return (
            <div
              key={lvl.label}
              className={`flex items-center justify-between rounded-md border px-3 py-1.5 ${
                isSwept ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${lvl.type === "resistance" ? "bg-loss" : "bg-profit"}`} />
                <span className="font-mono text-xs text-muted-foreground">{lvl.label}</span>
                {isSwept && <span className="font-mono text-[9px] text-primary">SWEPT</span>}
              </div>
              <span className="font-mono text-xs font-semibold text-foreground">
                {lvl.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>

      {signal.fvg_detected && (
        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="font-mono text-[10px] text-primary">FVG: {signal.fvg_bottom?.toLocaleString("en-US", { minimumFractionDigits: 2 })} – {signal.fvg_top?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
      )}
      {signal.order_block_detected && (
        <div className="mt-1.5 rounded-md border border-accent/20 bg-accent/5 px-3 py-2">
          <div className="font-mono text-[10px] text-accent">OB: {signal.ob_low?.toLocaleString("en-US", { minimumFractionDigits: 2 })} – {signal.ob_high?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
      )}
    </div>
  );
}