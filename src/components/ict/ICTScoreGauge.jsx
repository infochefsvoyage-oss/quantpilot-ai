import React from "react";
import { ICT_SCORE_THRESHOLDS } from "@/lib/ictData";

export default function ICTScoreGauge({ score, decision }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= ICT_SCORE_THRESHOLDS.PAPER_ENTRY ? "text-profit" : score >= ICT_SCORE_THRESHOLDS.ARMED ? "text-warning" : "text-loss";
  const stroke = score >= ICT_SCORE_THRESHOLDS.PAPER_ENTRY ? "#22c55e" : score >= ICT_SCORE_THRESHOLDS.ARMED ? "#f59e0b" : "#ef4444";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold text-foreground">ICT Score</span>
        <span className="font-mono text-xs text-muted-foreground">0–100</span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-mono text-3xl font-bold ${color}`}>{score}</span>
            <span className="font-mono text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-loss" /> &lt;50</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> 50–69</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-profit" /> ≥70</span>
        </div>
      </div>
    </div>
  );
}