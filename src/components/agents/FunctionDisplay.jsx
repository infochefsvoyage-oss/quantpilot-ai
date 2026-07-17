import React, { useState } from "react";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";

const statusConfig = {
  pending: { icon: Loader2, color: "text-warning", spin: true, label: "pending" },
  running: { icon: Loader2, color: "text-warning", spin: true, label: "running" },
  in_progress: { icon: Loader2, color: "text-primary", spin: true, label: "in_progress" },
  completed: { icon: CheckCircle2, color: "text-primary", spin: false, label: "completed" },
  success: { icon: CheckCircle2, color: "text-profit", spin: false, label: "success" },
  failed: { icon: XCircle, color: "text-loss", spin: false, label: "failed" },
  error: { icon: XCircle, color: "text-loss", spin: false, label: "error" },
};

function formatLabel(toolCall) {
  if (toolCall.display_projection?.label) return toolCall.display_projection.label;
  if (toolCall.display_projection?.active_label) return toolCall.display_projection.active_label;
  return toolCall.name || "function";
}

export default function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || "pending";
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const isFailed = status === "failed" || status === "error";
  const hideDetails = toolCall.display_projection?.hide_details && toolCall.display_projection?.details_redacted;

  let parsedArgs = null;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { parsedArgs = toolCall.arguments_string; }

  let parsedResults = null;
  try { parsedResults = typeof toolCall.results === "string" ? JSON.parse(toolCall.results) : toolCall.results; }
  catch { parsedResults = toolCall.results; }

  const isBlocked = isFailed || (typeof parsedResults === "object" && parsedResults?.success === false) ||
    (typeof parsedResults === "string" && /error|failed/i.test(parsedResults));

  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/40 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <Icon className={`h-3.5 w-3.5 ${config.color} ${config.spin ? "animate-spin" : ""}`} />
        <span className={`font-mono font-semibold ${isBlocked ? "text-loss" : config.color}`}>
          {formatLabel(toolCall)}
        </span>
        <span className="text-muted-foreground">— {config.label}</span>
      </button>
      {expanded && !hideDetails && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {parsedArgs && (
            <div>
              <div className="text-muted-foreground mb-1">Parameters:</div>
              <pre className="font-mono text-[10px] text-foreground/80 overflow-x-auto scrollbar-thin whitespace-pre-wrap break-all">
                {JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
          {parsedResults !== null && parsedResults !== undefined && (
            <div>
              <div className="text-muted-foreground mb-1">Result:</div>
              <pre className={`font-mono text-[10px] overflow-x-auto scrollbar-thin whitespace-pre-wrap break-all ${isBlocked ? "text-loss/80" : "text-profit/80"}`}>
                {JSON.stringify(parsedResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      {expanded && hideDetails && (
        <div className="border-t border-border px-3 py-2 text-muted-foreground text-[10px]">
          Details redacted
        </div>
      )}
    </div>
  );
}