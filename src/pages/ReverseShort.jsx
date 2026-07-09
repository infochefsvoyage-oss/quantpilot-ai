import React, { useState } from "react";
import { TrendingDown, Target, Crosshair, AlertTriangle, BookOpen } from "lucide-react";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import GateIndicator from "@/components/GateIndicator";
import {
  reverseShortSignals, reverseShortPlaybook,
  reversalTypeMeta, shortDecisionMeta,
} from "@/lib/extendedData";
import { formatPrice } from "@/lib/quantData";

export default function ReverseShort() {
  const [selected, setSelected] = useState(reverseShortSignals[0]);

  const allGatesPassed = selected
    ? selected.liquidity_sweep_detected && selected.volume_confirmation && selected.htf_bias === "SHORT"
    : false;

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-loss" />
          Reverse-Short Playbook
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Short-Strategien, Reversal-Logik, Liquiditäts-Sweeps, Runner-Exit-Strategien & Trailing-Stop-Management
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Signal List */}
        <div className="lg:col-span-1">
          <PanelCard title="Reversal-Signale">
            <div className="space-y-3">
              {reverseShortSignals.map((sig) => {
                const meta = shortDecisionMeta[sig.decision];
                const isActive = selected?.id === sig.id;
                return (
                  <button
                    key={sig.id}
                    onClick={() => setSelected(sig)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isActive ? "border-loss bg-loss/5 glow-red" : "border-border bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-foreground">{sig.symbol}</span>
                      <StatusBadge status={meta.label} color={meta.color} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{reversalTypeMeta[sig.reversal_type].label}</span>
                      <span className="font-mono text-muted-foreground">Score {sig.ascan_score}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </PanelCard>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-2">
          {selected && (
            <>
              {/* Signal Header */}
              <PanelCard title={`Reverse-Short Signal: ${selected.symbol}`}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Metric label="ASCAN Score" value={selected.ascan_score} color={selected.ascan_score >= 75 ? "profit" : "warning"} />
                  <Metric label="RR" value={selected.rr} color={selected.rr >= 2.5 ? "profit" : "warning"} />
                  <Metric label="Reversal Type" value={reversalTypeMeta[selected.reversal_type].label} color="foreground" small />
                  <Metric label="HTF Bias" value={selected.htf_bias} color={selected.htf_bias === "SHORT" ? "profit" : "muted"} />
                </div>
              </PanelCard>

              {/* Validation Gates */}
              <PanelCard title="Reversal-Validierung (Gates)" className="mt-4">
                <div className="space-y-2">
                  <GateIndicator label="Liquidity Sweep erkannt" passed={selected.liquidity_sweep_detected} />
                  <GateIndicator label="Sweep-Richtung (UPWARD für Short)" passed={selected.sweep_direction === "UPWARD_SWEEP"} />
                  <GateIndicator label="Volume Confirmation" passed={selected.volume_confirmation} />
                  <GateIndicator label="HTF Alignment (SHORT Bias)" passed={selected.htf_bias === "SHORT"} />
                </div>
                <div className={`mt-4 flex items-center gap-3 rounded-md border px-4 py-3 ${
                  allGatesPassed ? "border-profit/30 bg-profit/5" : "border-warning/30 bg-warning/5"
                }`}>
                  {allGatesPassed ? (
                    <>
                      <Target className="h-5 w-5 text-profit" />
                      <span className="text-sm font-semibold text-profit">Alle Gates erfüllt – Short-Setup valide</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <span className="text-sm font-semibold text-warning">Gates nicht vollständig – WATCH_ONLY oder NO_TRADE</span>
                    </>
                  )}
                </div>
              </PanelCard>

              {/* Price Levels */}
              <PanelCard title="Price Levels & Exit-Strategie" className="mt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <PriceRow label="Entry (Short)" value={formatPrice(selected.entry_price)} color="foreground" />
                  <PriceRow label="Stop Loss" value={formatPrice(selected.stop_loss)} color="loss" />
                  <PriceRow label="TP1" value={formatPrice(selected.tp1_price)} color="profit" />
                  <PriceRow label="TP2" value={formatPrice(selected.tp2_price)} color="profit" />
                  <PriceRow label="TP3 Runner" value={formatPrice(selected.tp3_runner_price)} color="cyan" />
                  <PriceRow label="Trailing Stop Distanz" value={`${selected.trailing_stop_distance_percent.toFixed(1)}%`} color="warning" />
                </div>
                <div className="mt-4 rounded-md border border-border bg-secondary/30 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">Runner-Exit-Strategie</span>
                    </div>
                    <StatusBadge status={selected.runner_exit_strategy.replace(/_/g, " ")} color="cyan" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Trailing Stop aktiv</span>
                  <StatusBadge status={selected.trailing_stop_active ? "AKTIV" : "INAKTIV"} color={selected.trailing_stop_active ? "profit" : "muted"} />
                </div>
              </PanelCard>

              {/* Governance Status */}
              <PanelCard title="Governance-Status" className="mt-4">
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
                  <span className="text-sm text-foreground">Ausführungs-Freigabe</span>
                  <StatusBadge status={selected.governance_approved ? "FREIGEGEBEN" : "AUSSTEHEND"} color={selected.governance_approved ? "profit" : "warning"} />
                </div>
                {selected.notes && (
                  <p className="mt-3 text-xs text-muted-foreground">{selected.notes}</p>
                )}
              </PanelCard>
            </>
          )}
        </div>
      </div>

      {/* Playbook Registry */}
      <PanelCard title="Reverse-Short Playbook Registry" className="mt-4" action={<BookOpen className="h-4 w-4 text-muted-foreground" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Pattern</th>
                <th className="px-3 py-2 text-left font-medium">Trigger</th>
                <th className="px-3 py-2 text-right font-medium">Min. Score</th>
                <th className="px-3 py-2 text-right font-medium">Min. RR</th>
                <th className="px-3 py-2 text-left font-medium">Exit-Strategie</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reverseShortPlaybook.map((pb) => (
                <tr key={pb.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-3 font-mono font-semibold text-foreground">{pb.pattern}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{pb.trigger}</td>
                  <td className="px-3 py-3 text-right font-mono text-foreground">{pb.min_score}</td>
                  <td className="px-3 py-3 text-right font-mono text-foreground">{pb.min_rr}</td>
                  <td className="px-3 py-3 text-xs text-foreground">{pb.exit}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={pb.active ? "AKTIV" : "INAKTIV"} color={pb.active ? "profit" : "muted"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}

function Metric({ label, value, color, small }) {
  const colors = { profit: "text-profit", loss: "text-loss", warning: "text-warning", cyan: "text-primary", foreground: "text-foreground", muted: "text-muted-foreground" };
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono font-bold ${small ? "text-xs" : "text-lg"} ${colors[color]}`}>{value}</div>
    </div>
  );
}

function PriceRow({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", warning: "text-warning", cyan: "text-primary", foreground: "text-foreground" };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-bold ${colors[color]}`}>{value}</span>
    </div>
  );
}