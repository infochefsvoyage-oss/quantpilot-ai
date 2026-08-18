import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Crosshair, ShieldAlert, Lock,
  AlertTriangle, Activity, Gauge, Layers, Radio,
} from "lucide-react";
import {
  runtimeStatus, riskDefaults, portfolioSummary, sampleSignals,
  openTrades, pendingGovernance, ulfWarnings, decisionConfig,
  formatCurrency, formatPnl,
} from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import GateIndicator from "@/components/GateIndicator";
import ICTPipelineMonitor from "@/components/ict/ICTPipelineMonitor";

export default function Dashboard() {
  const topSignal = sampleSignals[0];
  const dailyPnlPositive = portfolioSummary.daily_pnl >= 0;
  const weeklyPnlPositive = portfolioSummary.weekly_pnl >= 0;

  return (
    <div className="min-h-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          QuantPilot AI – OP-777 Sniper Desk · Kapitalerhalt hat Vorrang
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Crosshair}
          label="Risiko pro Trade"
          value={`${riskDefaults.risk_per_trade}%`}
          sub={`Level ${riskDefaults.risk_level.replace("LEVEL_", "L")}`}
          color="primary"
        />
        <KpiCard
          icon={Layers}
          label="Offene Positionen"
          value={`${portfolioSummary.open_positions}`}
          sub={`Max ${riskDefaults.max_open_positions} · Exposure ${portfolioSummary.exposure_percent}%`}
          color="primary"
        />
        <KpiCard
          icon={dailyPnlPositive ? TrendingUp : TrendingDown}
          label="Tages-PnL"
          value={formatPnl(portfolioSummary.daily_pnl)}
          sub={`${formatPnl(portfolioSummary.daily_pnl_percent)}% · Ziel ${riskDefaults.daily_target}%`}
          color={dailyPnlPositive ? "profit" : "loss"}
        />
        <KpiCard
          icon={Gauge}
          label="Max Drawdown"
          value={`${portfolioSummary.max_drawdown}%`}
          sub={`Limit ${riskDefaults.max_drawdown_pause}%`}
          color={portfolioSummary.max_drawdown > riskDefaults.max_drawdown_pause * 0.7 ? "warning" : "primary"}
        />
      </div>

      {/* Runtime Status + Governance Pending */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard title="Runtime Status" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <RuntimeItem label="ASCAN Engine" value={runtimeStatus.ascan_engine} />
            <RuntimeItem label="ULF Governance" value={runtimeStatus.governance_engine} />
            <RuntimeItem label="Risk Engine" value={runtimeStatus.risk_engine} />
            <RuntimeItem label="Portfolio Engine" value={runtimeStatus.portfolio_engine} />
            <RuntimeItem label="Exchange Router" value={runtimeStatus.exchange_router} />
            <RuntimeItem label="Audit Log" value={runtimeStatus.audit_log} />
            <RuntimeItem label="Modus" value={runtimeStatus.mode} highlight />
            <RuntimeItem label="Exchange Phase" value={runtimeStatus.exchange_phase} />
            <RuntimeItem label="Circuit Breaker" value={runtimeStatus.circuit_breaker ? "ACTIVE" : "IDLE"} danger={runtimeStatus.circuit_breaker} />
          </div>
        </PanelCard>

        <PanelCard
          title="Governance Pending"
          action={
            <Link to="/governance" className="text-xs text-primary hover:underline">
              Alle ansehen →
            </Link>
          }
        >
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 glow-amber">
              <Lock className="h-7 w-7 text-warning" />
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-3xl font-bold text-warning">{pendingGovernance.length}</div>
            <div className="text-xs text-muted-foreground">Aktionen warten auf Freigabe</div>
          </div>
          <div className="mt-4 space-y-2">
            {pendingGovernance.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2">
                <span className="text-xs text-foreground">{g.action_type.replace(/_/g, " ")}</span>
                <StatusBadge status="PENDING" color="warning" />
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      {/* A+ Gate Status + Letzte Signale */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard title="A+ Gate Status – Top Signal">
          <div className="space-y-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">{topSignal.symbol}</span>
                <StatusBadge status={topSignal.exchange} color="muted" />
              </div>
              <StatusBadge
                status={decisionConfig[topSignal.decision].label}
                color={decisionConfig[topSignal.decision].color}
              />
            </div>
            <GateIndicator label="Liquidity Sweep" passed={topSignal.gate_liquidity_sweep} />
            <GateIndicator label="Reclaim / Rejection" passed={topSignal.gate_reclaim_rejection} />
            <GateIndicator label="Volume Confirmation" passed={topSignal.gate_volume_confirmation} />
            <GateIndicator label="HTF Alignment" passed={topSignal.gate_htf_alignment} />
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
              <Metric label="ASCAN Score" value={topSignal.ascan_score} good={topSignal.ascan_score >= 75} />
              <Metric label="RR" value={topSignal.rr.toFixed(1)} good={topSignal.rr >= 2.5} />
              <Metric label="HTF Bias" value={topSignal.htf_bias} good={topSignal.htf_bias !== "NEUTRAL"} />
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Letzte Signale"
          action={
            <Link to="/sniper" className="text-xs text-primary hover:underline">
              Sniper Mode →
            </Link>
          }
        >
          <div className="space-y-2">
            {sampleSignals.map((s) => {
              const dc = decisionConfig[s.decision];
              return (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold">{s.symbol}</span>
                    <span className="text-xs text-muted-foreground">{s.exchange}</span>
                    <div className="flex gap-0.5">
                      {[s.gate_liquidity_sweep, s.gate_reclaim_rejection, s.gate_volume_confirmation, s.gate_htf_alignment].map((g, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${g ? "bg-profit" : "bg-loss"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">S:{s.ascan_score} · RR:{s.rr.toFixed(1)}</span>
                    <StatusBadge status={dc.label} color={dc.color} />
                  </div>
                </div>
              );
            })}
          </div>
        </PanelCard>
      </div>

      {/* ULF Warnungen */}
      <div className="mt-4">
        <PanelCard title="ULF Warnungen" action={<AlertTriangle className="h-4 w-4 text-warning" />}>
          <div className="space-y-2">
            {ulfWarnings.map((w) => (
              <div key={w.id} className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  w.severity === "CRITICAL" ? "bg-loss" : w.severity === "WARNING" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{w.module}</span>
                    <StatusBadge status={w.severity} color={
                      w.severity === "CRITICAL" ? "loss" : w.severity === "WARNING" ? "warning" : "cyan"
                    } />
                  </div>
                  <p className="mt-1 text-sm text-foreground">{w.message}</p>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      {/* Offene Positionen */}
      <div className="mt-4">
        <PanelCard title="Offene Positionen">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Symbol</th>
                  <th className="pb-2 text-left font-medium">Seite</th>
                  <th className="pb-2 text-right font-medium">Entry</th>
                  <th className="pb-2 text-right font-medium">Stop</th>
                  <th className="pb-2 text-center font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">PnL</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2.5 font-mono font-semibold">{t.symbol}</td>
                    <td className="py-2.5">
                      <span className={t.side === "LONG" ? "text-profit" : "text-loss"}>{t.side}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">{t.entry_price.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-right font-mono text-loss">{t.stop_loss.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-center">
                      <StatusBadge status={t.status} color={t.status.includes("TP") ? "profit" : "muted"} />
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-profit">{formatPnl(t.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      </div>

      {/* ICT Pipeline Read-Only Performance Monitor */}
      <div className="mt-4">
        <ICTPipelineMonitor />
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-warning">Daily Profit ist ein Ziel-KPI, kein Versprechen.</span>{" "}
            Täglicher Gewinn kann nicht garantiert werden. Kapitalerhalt hat absoluten Vorrang. Trading birgt Risiko des Totalverlusts.
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    primary: "text-primary bg-primary/10",
    profit: "text-profit bg-profit/10",
    loss: "text-loss bg-loss/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`mt-3 font-mono text-2xl font-bold ${colors[color].split(" ")[0]}`}>{value}</div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function RuntimeItem({ label, value, highlight, danger }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-semibold ${
        danger ? "text-loss" : highlight ? "text-primary" : value === "ACTIVE" ? "text-profit" : "text-foreground"
      }`}>
        {value}
      </span>
    </div>
  );
}

function Metric({ label, value, good }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${good ? "text-profit" : "text-loss"}`}>{value}</div>
    </div>
  );
}