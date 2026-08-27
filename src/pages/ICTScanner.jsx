import React, { useState } from "react";
import { Radar, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { mockICTSignals, feedStatus, evaluateDecision } from "@/lib/ictData";
import PanelCard from "@/components/PanelCard";
import KillzoneClock from "@/components/ict/KillzoneClock";
import ICTSignalCard from "@/components/ict/ICTSignalCard";
import SignalDetail from "@/components/ict/SignalDetail";

export default function ICTScanner() {
  const [signals] = useState(mockICTSignals);
  const [selectedId, setSelectedId] = useState(mockICTSignals[0].id);
  const selected = signals.find((s) => s.id === selectedId);

  const paperEntries = signals.filter((s) => evaluateDecision(s) === "PAPER_ENTRY").length;
  const noTrades = signals.filter((s) => evaluateDecision(s) === "NO_TRADE").length;

  return (
    <div className="min-h-full p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Radar className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">ICT Market Scanner v2</h1>
          <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">PAPER / SHADOW ONLY</span>
        </div>
        <p className="text-sm text-muted-foreground">
          ICT-Spezialist: Sweep → Displacement → MSS → FVG Pipeline · Hard Gates überstimmen jeden Score
        </p>
      </div>

      {/* Feed Status Banner */}
      <div className={`mb-4 rounded-lg border p-4 ${feedStatus.connected ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {feedStatus.connected ? (
              <Wifi className="h-5 w-5 text-profit" />
            ) : (
              <WifiOff className="h-5 w-5 text-loss" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-sm font-semibold text-foreground">Live Market Data</span>
                <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${feedStatus.connected ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                  {feedStatus.mode}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{feedStatus.block_reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">Symbols</div>
              <div className="font-bold text-foreground">{feedStatus.symbols_watched.join(" · ")}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Lag</div>
              <div className={`font-bold ${feedStatus.connected ? "text-profit" : "text-loss"}`}>
                {feedStatus.lag_ms}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Aktive Signale" value={signals.length} color="primary" />
        <StatCard label="PAPER Entry" value={paperEntries} color="profit" />
        <StatCard label="NO TRADE (Gates)" value={noTrades} color="loss" />
        <StatCard label="Live Execution" value="BLOCKED" color="loss" />
      </div>

      {/* Killzone + Signal List */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <KillzoneClock />
        </div>
        <div className="lg:col-span-2">
          <PanelCard title="Aktive ICT Signale">
            <div className="space-y-2">
              {signals.map((s) => (
                <ICTSignalCard
                  key={s.id}
                  signal={s}
                  active={s.id === selectedId}
                  onSelect={() => setSelectedId(s.id)}
                />
              ))}
            </div>
          </PanelCard>
        </div>
      </div>

      {/* Signal Detail */}
      {selected && <SignalDetail signal={selected} />}

      {/* Disclaimer */}
      <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-warning">ICT Scanner erzeugt nur Signale — keine direkte Order-Ausführung.</span>{" "}
            Ein Signal wird BLOCKED, wenn Live-Daten fehlen, Daten stale sind, kein Liquidity Sweep, kein Displacement, kein MSS/BOS, kein FVG/OB-Entry, CRV unter Minimum, News-Gate blockiert, Risk Engine blockiert oder Governance nicht APPROVED ist. Ein hoher Score kann keinen Hard Gate überstimmen.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    primary: "text-primary",
    profit: "text-profit",
    loss: "text-loss",
    warning: "text-warning",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}