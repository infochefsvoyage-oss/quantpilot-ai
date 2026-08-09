import React from "react";
import { Target, Layers, Compass } from "lucide-react";
import { evaluateDecision, evaluatePipelineStage, DECISION_CONFIG, PIPELINE_CONFIG } from "@/lib/ictData";
import StatusBadge from "@/components/StatusBadge";
import ICTGateMatrix from "@/components/ict/ICTGateMatrix";
import ICTScoreGauge from "@/components/ict/ICTScoreGauge";
import LiquidityMap from "@/components/ict/LiquidityMap";
import PipelineFlow from "@/components/ict/PipelineFlow";

export default function SignalDetail({ signal }) {
  const decision = evaluateDecision(signal);
  const stage = evaluatePipelineStage(signal);
  const dc = DECISION_CONFIG[decision];
  const pc = PIPELINE_CONFIG[stage];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-foreground">{signal.symbol}</span>
            <span className={`font-mono text-sm font-bold ${signal.side === "LONG" ? "text-profit" : "text-loss"}`}>
              {signal.side}
            </span>
            <StatusBadge status={signal.source} color="muted" />
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={pc.label} color={pc.color} />
            <StatusBadge status={dc.label} color={dc.color} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <DetailItem label="Entry TF" value={signal.timeframe_entry} />
          <DetailItem label="Context TF" value={signal.timeframe_context} />
          <DetailItem label="HTF Structure" value={signal.htf_market_structure} />
          <DetailItem label="Killzone" value={signal.killzone} />
        </div>
      </div>

      {/* Pipeline + Score */}
      <PipelineFlow signal={signal} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ICTScoreGauge score={signal.ict_score} decision={decision} />
        <ICTGateMatrix signal={signal} />
      </div>

      {/* Liquidity + Entry */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LiquidityMap signal={signal} />

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm font-semibold text-foreground">Entry / SL / TP</span>
          </div>
          {signal.entry_price != null ? (
            <div className="space-y-2">
              <PriceRow label="Entry" value={signal.entry_price} color="text-primary" />
              <PriceRow label="Stop Loss" value={signal.stop_loss} color="text-loss" />
              <PriceRow label="TP1 (40%)" value={signal.tp1} color="text-profit" />
              <PriceRow label="TP2 (30%)" value={signal.tp2} color="text-profit" />
              <PriceRow label="TP3 Runner (30%)" value={signal.tp3} color="text-profit" />
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-xs text-muted-foreground">CRV</span>
                <span className={`font-mono text-sm font-bold ${signal.crv >= 2 ? "text-profit" : "text-loss"}`}>
                  {signal.crv?.toFixed(2)} {signal.crv >= 2 ? "✓" : "✗"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Layers className="h-6 w-6 mb-2 opacity-40" />
              <span className="text-xs">Kein Entry — Hard Gates blockiert</span>
            </div>
          )}
        </div>
      </div>

      {/* ASCAN vs ICT Vergleich */}
      <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Compass className="h-4 w-4 text-warning" />
          <span className="font-heading text-sm font-semibold text-foreground">ASCAN vs ICT (Sperrlogik)</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground">ASCAN Score</div>
            <div className="font-mono text-xl font-bold text-foreground">{signal.ascan_score ?? "—"}</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground">ICT Score</div>
            <div className={`font-mono text-xl font-bold ${signal.ict_score >= 70 ? "text-profit" : "text-loss"}`}>
              {signal.ict_score}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground">Entscheidung</div>
            <div className={`font-mono text-sm font-bold ${decision === "PAPER_ENTRY" ? "text-profit" : "text-loss"}`}>
              {dc.label}
            </div>
          </div>
        </div>
        {signal.ascan_score >= 70 && decision === "NO_TRADE" && (
          <p className="mt-3 text-center text-xs text-loss font-semibold">
            ⛔ ASCAN-Score {signal.ascan_score} durch ICT Hard Gates überstimmt → NO TRADE
          </p>
        )}
      </div>

      {/* Notes */}
      {signal.notes && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground">{signal.notes}</p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function PriceRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>
        {value?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—"}
      </span>
    </div>
  );
}