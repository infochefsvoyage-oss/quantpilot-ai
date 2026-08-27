import React, { useState } from "react";
import { Crosshair, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import {
  sampleSignals, decisionConfig, riskDefaults, formatPrice,
} from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import GateIndicator from "@/components/GateIndicator";

export default function SniperMode() {
  const [selectedSignal, setSelectedSignal] = useState(sampleSignals[0]);
  const [orderMode, setOrderMode] = useState("PAPER");

  const gates = [
    { label: "Liquidity Sweep", passed: selectedSignal.gate_liquidity_sweep },
    { label: "Reclaim / Rejection", passed: selectedSignal.gate_reclaim_rejection },
    { label: "Volume Confirmation", passed: selectedSignal.gate_volume_confirmation },
    { label: "HTF Alignment", passed: selectedSignal.gate_htf_alignment },
  ];
  const gatesPassed = gates.filter((g) => g.passed).length;
  const isAPlus = gatesPassed === 4 && selectedSignal.ascan_score >= 75 && selectedSignal.rr >= 2.5;
  const canTrade = selectedSignal.decision === "ENTER" || selectedSignal.decision === "ENTER_REDUCED";

  return (
    <div className="min-h-full p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-primary" />
            Sniper Mode
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">A+ Setup Erkennung – alle 4 Gates müssen erfüllt sein</p>
        </div>
        <div className="flex items-center gap-2">
          {["PAPER", "SHADOW", "LIVE"].map((m) => (
            <button
              key={m}
              onClick={() => setOrderMode(m)}
              disabled={m === "LIVE"}
              className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                orderMode === m
                  ? "bg-primary text-primary-foreground"
                  : m === "LIVE"
                  ? "border border-loss/30 bg-loss/5 text-loss/40 cursor-not-allowed"
                  : "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
            >
              {m === "LIVE" && "🔒 "}
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Signal List */}
        <PanelCard title="Gescannte Signale" className="lg:col-span-1">
          <div className="space-y-2">
            {sampleSignals.map((s) => {
              const dc = decisionConfig[s.decision];
              const active = selectedSignal.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSignal(s)}
                  className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{s.symbol}</span>
                      <span className="text-xs text-muted-foreground">{s.exchange}</span>
                    </div>
                    <StatusBadge status={dc.label} color={dc.color} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-0.5">
                      {[s.gate_liquidity_sweep, s.gate_reclaim_rejection, s.gate_volume_confirmation, s.gate_htf_alignment].map((g, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${g ? "bg-profit" : "bg-loss"}`} />
                      ))}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      Score {s.ascan_score} · RR {s.rr.toFixed(1)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </PanelCard>

        {/* Signal Detail */}
        <div className="lg:col-span-2 space-y-4">
          <PanelCard title="Signal Detail – A+ Gate Check">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl font-bold text-foreground">{selectedSignal.symbol}</span>
                <StatusBadge status={selectedSignal.exchange} color="muted" />
                <StatusBadge
                  status={selectedSignal.htf_bias}
                  color={selectedSignal.htf_bias === "LONG" ? "profit" : selectedSignal.htf_bias === "SHORT" ? "loss" : "muted"}
                />
              </div>
              <div className="text-right">
                <StatusBadge status={decisionConfig[selectedSignal.decision].label} color={decisionConfig[selectedSignal.decision].color} />
                <p className="mt-1 text-xs text-muted-foreground">{decisionConfig[selectedSignal.decision].desc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {gates.map((g) => (
                <GateIndicator key={g.label} label={g.label} passed={g.passed} />
              ))}
            </div>

            <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Zusätzliche Checks</span>
                <span className={`font-mono text-xs ${isAPlus ? "text-profit" : "text-loss"}`}>
                  {isAPlus ? "A+ BESTÄTIGT" : "NICHT A+"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                <CheckRow label="Spread OK" ok={selectedSignal.spread_ok} />
                <CheckRow label="Funding OK" ok={selectedSignal.funding_ok} />
                <CheckRow label="Daten frisch" ok={selectedSignal.data_fresh} />
                <CheckRow label="Stop Loss" ok={selectedSignal.stop_loss_present} />
                <CheckRow label="Score ≥ 75" ok={selectedSignal.ascan_score >= 75} />
                <CheckRow label="RR ≥ 2.5" ok={selectedSignal.rr >= 2.5} />
              </div>
            </div>
          </PanelCard>

          {/* Order Ticket */}
          <PanelCard title="Order Ticket">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <OrderField label="Entry" value={formatPrice(selectedSignal.entry_price)} />
              <OrderField label="Stop Loss" value={formatPrice(selectedSignal.stop_loss)} color="loss" />
              <OrderField label="TP1 (40%)" value={formatPrice(selectedSignal.take_profit_1)} color="profit" />
              <OrderField label="TP2 (30%)" value={formatPrice(selectedSignal.take_profit_2)} color="profit" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <OrderField label="TP3 (30%)" value={formatPrice(selectedSignal.take_profit_3)} color="profit" />
              <OrderField label="ASCAN Score" value={selectedSignal.ascan_score} color={selectedSignal.ascan_score >= 75 ? "profit" : "loss"} />
              <OrderField label="RR" value={selectedSignal.rr.toFixed(2)} color={selectedSignal.rr >= 2.5 ? "profit" : "loss"} />
              <OrderField label="Risiko/Trade" value={`${riskDefaults.risk_per_trade}%`} color="primary" />
            </div>

            <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Money Management:</span> TP1 40% schließen + Stop auf BE · TP2 30% schließen + Trailing · TP3 30% Runner
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                disabled={!canTrade}
                className={`flex-1 rounded-md py-3 font-semibold text-sm transition-colors ${
                  canTrade
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
                    : "bg-secondary text-muted-foreground cursor-not-allowed"
                }`}
              >
                {canTrade ? `${orderMode} ORDER ERSTELLEN` : "KEIN TRADE – GATES NICHT ERFÜLLT"}
              </button>
              <button className="rounded-md border border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground hover:bg-secondary/70">
                Watch Only
              </button>
            </div>

            {!canTrade && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-loss/5 px-3 py-2">
                <XCircle className="h-4 w-4 shrink-0 text-loss mt-0.5" />
                <p className="text-xs text-loss">
                  Decision State ist <span className="font-mono font-semibold">{selectedSignal.decision}</span> –
                  Mind. ein Gater fehlt. Standard: WATCH_ONLY oder NO_TRADE.
                </p>
              </div>
            )}
            {canTrade && selectedSignal.decision === "ENTER_REDUCED" && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-warning/5 px-3 py-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <p className="text-xs text-warning">
                  ENTER_REDUCED: HTF nur partiell aligned – Position wird automatisch reduziert.
                </p>
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, ok }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-profit" /> : <XCircle className="h-3.5 w-3.5 text-loss" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function OrderField({ label, value, color = "muted" }) {
  const colors = {
    muted: "text-foreground",
    profit: "text-profit",
    loss: "text-loss",
    primary: "text-primary",
  };
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}