import React, { useState } from "react";
import { Radar, TrendingUp, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, Activity } from "lucide-react";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import {
  arbOpportunities, arbRegimeStats, arbExchangeStatus,
  arbStatusMeta, regimeMeta,
} from "@/lib/extendedData";

export default function ArbScan() {
  const [filterRegime, setFilterRegime] = useState("ALL");
  const [filterProfitable, setFilterProfitable] = useState(false);

  const filtered = arbOpportunities.filter((a) => {
    if (filterRegime !== "ALL" && a.market_regime !== filterRegime) return false;
    if (filterProfitable && !a.is_profitable_after_costs) return false;
    return true;
  });

  const totalAlerted = arbOpportunities.filter((a) => a.telegram_alert_sent).length;
  const totalProfitable = arbOpportunities.filter((a) => a.is_profitable_after_costs).length;
  const totalGovernancePending = arbOpportunities.filter((a) => a.status === "GOVERNANCE_PENDING").length;

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Radar className="h-6 w-6 text-primary" />
          ARB-Scan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Multi-Exchange Arbitrage-Scanner – Netto-Chancen nach Kosten, Regime-Erkennung, Governance-gated
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Radar} label="Gescannte Symbole" value="700+" color="cyan" />
        <KpiCard icon={AlertTriangle} label="Alerts gesendet" value={totalAlerted} color="warning" />
        <KpiCard icon={CheckCircle2} label="Profitabel nach Kosten" value={totalProfitable} color="profit" />
        <KpiCard icon={Activity} label="Governance ausstehend" value={totalGovernancePending} color="loss" />
      </div>

      {/* Exchange Status */}
      <PanelCard title="Exchange-Verbindungen (CCXT)" className="mt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {arbExchangeStatus.map((ex) => (
            <div key={ex.exchange} className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-foreground">{ex.exchange}</span>
                <StatusBadge status={ex.status} color={ex.status === "CONNECTED" ? "profit" : "warning"} />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Latenz</span>
                  <span className={`font-mono ${ex.latency_ms > 200 ? "text-warning" : "text-foreground"}`}>{ex.latency_ms}ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Symbole</span>
                  <span className="font-mono text-foreground">{ex.symbols_scanned}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rate Limit</span>
                  <span className={`font-mono ${ex.rate_limit_percent > 80 ? "text-loss" : ex.rate_limit_percent > 60 ? "text-warning" : "text-profit"}`}>
                    {ex.rate_limit_percent}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Regime Stats */}
      <PanelCard title="Markt-Regime Klassifizierung" className="mt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {Object.entries(arbRegimeStats).map(([regime, stats]) => {
            const meta = regimeMeta[regime];
            return (
              <div key={regime} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <StatusBadge status={regime} color={meta.color} />
                  <span className="font-mono text-xs text-muted-foreground">{stats.count} Scans</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ø Spread</span>
                    <span className="font-mono text-foreground">{stats.avg_spread}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Profitabel</span>
                    <span className={`font-mono ${stats.profitable > 0 ? "text-profit" : "text-muted-foreground"}`}>{stats.profitable}</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">{meta.desc}</p>
              </div>
            );
          })}
        </div>
      </PanelCard>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">Filter:</span>
        {["ALL", "CALM", "VOLATILE", "TRENDING", "ILLIQUID", "EXTREME"].map((r) => (
          <button
            key={r}
            onClick={() => setFilterRegime(r)}
            className={`rounded-md border px-3 py-1 font-mono text-xs transition-colors ${
              filterRegime === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={filterProfitable} onChange={(e) => setFilterProfitable(e.target.checked)} className="accent-primary" />
          Nur profitabel nach Kosten
        </label>
      </div>

      {/* Opportunities Table */}
      <PanelCard title="Arbitrage-Opportunities" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Symbol</th>
                <th className="px-3 py-2 text-left font-medium">Route</th>
                <th className="px-3 py-2 text-right font-medium">Raw Spread</th>
                <th className="px-3 py-2 text-right font-medium">Gebühren</th>
                <th className="px-3 py-2 text-right font-medium">Slippage</th>
                <th className="px-3 py-2 text-right font-medium">Netto</th>
                <th className="px-3 py-2 text-left font-medium">Regime</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => (
                <tr key={opp.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-3 font-mono font-semibold text-foreground">{opp.symbol}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-profit">{opp.buy_exchange}</span>
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-loss">{opp.sell_exchange}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-foreground">{opp.raw_spread_percent.toFixed(3)}%</td>
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground">{opp.taker_fee_percent.toFixed(3)}%</td>
                  <td className="px-3 py-3 text-right font-mono text-muted-foreground">{opp.estimated_slippage_percent.toFixed(3)}%</td>
                  <td className={`px-3 py-3 text-right font-mono font-bold ${opp.is_profitable_after_costs ? "text-profit" : "text-loss"}`}>
                    {opp.net_profit_percent >= 0 ? "+" : ""}{opp.net_profit_percent.toFixed(3)}%
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={opp.market_regime} color={regimeMeta[opp.market_regime].color} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={arbStatusMeta[opp.status].label} color={arbStatusMeta[opp.status].color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {/* Governance Warning */}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-warning">Keine automatische ARB-Ausführung ohne Governance-Freigabe</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Alle ARB-Chancen werden erkannt und bei wirtschaftlicher Relevanz per Telegram alertet.
            Die Ausführung erfolgt erst nach expliziter Freigabe über <code className="font-mono text-primary">POST /governance/approve</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  const colors = {
    profit: "text-profit bg-profit/10 border-profit/20",
    loss: "text-loss bg-loss/10 border-loss/20",
    warning: "text-warning bg-warning/10 border-warning/20",
    cyan: "text-primary bg-primary/10 border-primary/20",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className={`mb-3 inline-flex rounded-md border p-2 ${colors[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-mono text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}