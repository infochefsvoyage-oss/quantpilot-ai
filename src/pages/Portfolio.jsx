import React from "react";
import { Briefcase } from "lucide-react";
import {
  portfolioSummary, riskDefaults, openTrades, closedTradesToday,
  formatCurrency, formatPnl,
} from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function Portfolio() {
  const exposureUsed = (portfolioSummary.open_exposure / portfolioSummary.total_equity) * 100;
  const exposureCap = riskDefaults.portfolio_exposure_cap;

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Portfolio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Portfolio Engine – Exposure-Überwachung & Kapitalerhalt</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gesamtkapital" value={formatCurrency(portfolioSummary.total_equity)} unit="USDT" />
        <StatCard label="Verfügbare Margin" value={formatCurrency(portfolioSummary.available_margin)} unit="USDT" />
        <StatCard
          label="Offene Exposure"
          value={formatCurrency(portfolioSummary.open_exposure)}
          unit={`(${exposureUsed.toFixed(1)}% / ${exposureCap}%)`}
          color={exposureUsed > exposureCap * 0.8 ? "warning" : "primary"}
        />
        <StatCard
          label="Tages-PnL"
          value={formatPnl(portfolioSummary.daily_pnl)}
          unit={`${formatPnl(portfolioSummary.daily_pnl_percent)}%`}
          color={portfolioSummary.daily_pnl >= 0 ? "profit" : "loss"}
        />
      </div>

      {/* Exposure Bar */}
      <PanelCard title="Portfolio Exposure" className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Einsatz / Cap</span>
          <span className="font-mono font-semibold">{exposureUsed.toFixed(1)}% / {exposureCap}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${
              exposureUsed > exposureCap * 0.8 ? "bg-warning glow-amber" : "bg-primary glow-cyan"
            }`}
            style={{ width: `${Math.min((exposureUsed / exposureCap) * 100, 100)}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <MiniStat label="Wöchentl. PnL" value={formatPnl(portfolioSummary.weekly_pnl)} unit={`${formatPnl(portfolioSummary.weekly_pnl_percent)}%`} color={portfolioSummary.weekly_pnl >= 0 ? "profit" : "loss"} />
          <MiniStat label="Max Drawdown" value={`${portfolioSummary.max_drawdown}%`} unit={`Limit ${riskDefaults.max_drawdown_pause}%`} color="warning" />
          <MiniStat label="Aufeinanderf. Verluste" value={portfolioSummary.consecutive_losses} unit={`Halbierung bei ${riskDefaults.consecutive_losses_halve}`} color={portfolioSummary.consecutive_losses >= riskDefaults.consecutive_losses_halve ? "loss" : "muted"} />
          <MiniStat label="Tagesziel" value={`${riskDefaults.daily_target}%`} unit={portfolioSummary.daily_target_hit ? "erreicht ✓" : "nicht erreicht"} color={portfolioSummary.daily_target_hit ? "profit" : "muted"} />
        </div>
      </PanelCard>

      {/* Open Positions */}
      <PanelCard title="Offene Positionen" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Symbol</th>
                <th className="pb-2 text-left font-medium">Exchange</th>
                <th className="pb-2 text-left font-medium">Modus</th>
                <th className="pb-2 text-left font-medium">Seite</th>
                <th className="pb-2 text-right font-medium">Entry</th>
                <th className="pb-2 text-right font-medium">Stop</th>
                <th className="pb-2 text-right font-medium">Größe</th>
                <th className="pb-2 text-right font-medium">Risiko</th>
                <th className="pb-2 text-center font-medium">Status</th>
                <th className="pb-2 text-right font-medium">PnL</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2.5 font-mono font-semibold">{t.symbol}</td>
                  <td className="py-2.5 text-muted-foreground">{t.exchange}</td>
                  <td className="py-2.5"><StatusBadge status={t.mode} color={t.mode === "LIVE" ? "loss" : t.mode === "SHADOW" ? "warning" : "cyan"} /></td>
                  <td className="py-2.5"><span className={t.side === "LONG" ? "text-profit" : "text-loss"}>{t.side}</span></td>
                  <td className="py-2.5 text-right font-mono">{t.entry_price.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right font-mono text-loss">{t.stop_loss.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right font-mono">{t.position_size}</td>
                  <td className="py-2.5 text-right font-mono">{t.risk_percent}%</td>
                  <td className="py-2.5 text-center"><StatusBadge status={t.status} color={t.status.includes("TP") ? "profit" : "muted"} /></td>
                  <td className="py-2.5 text-right font-mono font-semibold text-profit">{formatPnl(t.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {/* Closed Today */}
      <PanelCard title="Geschlossene Trades – Heute" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Symbol</th>
                <th className="pb-2 text-left font-medium">Modus</th>
                <th className="pb-2 text-left font-medium">Seite</th>
                <th className="pb-2 text-center font-medium">Score</th>
                <th className="pb-2 text-center font-medium">Status</th>
                <th className="pb-2 text-right font-medium">PnL</th>
                <th className="pb-2 text-right font-medium">PnL %</th>
                <th className="pb-2 text-right font-medium">Geschlossen</th>
              </tr>
            </thead>
            <tbody>
              {closedTradesToday.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2.5 font-mono font-semibold">{t.symbol}</td>
                  <td className="py-2.5"><StatusBadge status={t.mode} color="cyan" /></td>
                  <td className="py-2.5"><span className={t.side === "LONG" ? "text-profit" : "text-loss"}>{t.side}</span></td>
                  <td className="py-2.5 text-center font-mono">{t.ascan_score}</td>
                  <td className="py-2.5 text-center"><StatusBadge status={t.status} color={t.status === "CLOSED" && t.pnl > 0 ? "profit" : "loss"} /></td>
                  <td className={`py-2.5 text-right font-mono font-semibold ${t.pnl >= 0 ? "text-profit" : "text-loss"}`}>{formatPnl(t.pnl)}</td>
                  <td className={`py-2.5 text-right font-mono ${t.pnl_percent >= 0 ? "text-profit" : "text-loss"}`}>{formatPnl(t.pnl_percent)}%</td>
                  <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{new Date(t.closed_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}

function StatCard({ label, value, unit, color = "muted" }) {
  const colors = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", primary: "text-primary", warning: "text-warning" };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-xl font-bold ${colors[color]}`}>{value}</div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

function MiniStat({ label, value, unit, color }) {
  const colors = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", primary: "text-primary", warning: "text-warning" };
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}