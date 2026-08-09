import React from "react";
import { ArrowRight, Activity } from "lucide-react";
import { PIPELINE_STEPS } from "@/lib/ictData";

export default function PipelineFlow({ signal }) {
  const stepStatus = {
    liquidity_sweep: signal.liquidity_sweep,
    displacement: signal.displacement,
    mss_bos: signal.mss_bos !== "NONE",
    fvg_ob: signal.fvg_detected || signal.order_block_detected,
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="font-heading text-sm font-semibold text-foreground">ICT Pipeline</span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {PIPELINE_STEPS.map((step, idx) => {
          const passed = stepStatus[step.key];
          return (
            <div key={step.key} className="flex items-center gap-1">
              <div
                className={`flex min-w-[110px] flex-col items-center rounded-md border px-3 py-2.5 ${
                  passed ? "border-profit/30 bg-profit/5" : "border-loss/20 bg-loss/5"
                }`}
              >
                <span className={`font-mono text-[10px] font-bold uppercase ${passed ? "text-profit" : "text-loss"}`}>
                  {passed ? "✓" : "✗"} {step.label}
                </span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <ArrowRight className={`h-4 w-4 shrink-0 ${passed ? "text-profit" : "text-loss/40"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-center font-mono text-[10px] text-muted-foreground">
        Sweep → Displacement → MSS/BOS → FVG/OB Entry
      </div>
    </div>
  );
}