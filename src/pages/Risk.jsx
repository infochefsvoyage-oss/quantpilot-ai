import React, { useState } from "react";
import { ShieldAlert, Shield, TrendingDown, Lock, AlertTriangle } from "lucide-react";
import { riskDefaults, portfolioSummary } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function Risk() {
  const [settings, setSettings] = useState(riskDefaults);

  const dailyLossUsed = Math.abs(Math.min(portfolioSummary.daily_pnl_percent, 0));
  const dailyLossPercent = (dailyLossUsed / settings.daily_loss_limit) * 100;
  const drawdownPercent = (portfolioSummary.max_drawdown / settings.max_drawdown_pause) * 100;

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          Risiko
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Risk Engine – Kapitalerhalt hat Vorrang (Capital Preservation First)</p>
      </div>

      {/* Loss Limits */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard title="Tagesverlust-Limit">
          <div className="text-center">
            <div className="font-mono text-3xl font-bold text-loss">{settings.daily_loss_limit}%</div>
            <div className="mt-1 text-xs text-muted-foreground">Aktuell: {dailyLossUsed.toFixed(2)}% verwendet</div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full ${dailyLossPercent > 80 ? "bg-loss glow-red" : "bg-warning"}`} style={{ width: `${Math.min(dailyLossPercent, 100)}%` }} />
          </div>
          {dailyLossPercent > 80 && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-loss/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-loss" />
              <span className="text-xs text-loss font-semibold">Trading-Pause kurz vor Auslösung!</span>
            </div>
          )}
        </PanelCard>

        <PanelCard title="Max Drawdown Pause">
          <div className="text-center">
            <div className="font-mono text-3xl font-bold text-warning">{settings.max_drawdown_pause}%</div>
            <div className="mt-1 text-xs text-muted-foreground">Aktuell: {portfolioSummary.max_drawdown}% erreicht</div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full rounded-full ${drawdownPercent > 80 ? "bg-loss glow-red" : "bg-warning glow-amber"}`} style={{ width: `${Math.min(drawdownPercent, 100)}%` }} />
          </div>
        </PanelCard>

        <PanelCard title="Wochenverlust-Limit">
          <div className="text-center">
            <div className="font-mono text-3xl font-bold text-loss">{settings.weekly_loss_limit}%</div>
            <div className="mt-1 text-xs text-muted-foreground">Aktuell: {Math.abs(portfolioSummary.weekly_pnl_percent).toFixed(2)}% verwendet</div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min((Math.abs(portfolioSummary.weekly_pnl_percent) / settings.weekly_loss_limit) * 100, 100)}%` }} />
          </div>
        </PanelCard>
      </div>

      {/* Risk Defaults Config */}
      <PanelCard title="Risk Defaults Konfiguration" className="mt-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RiskField label="Risk Level" value={settings.risk_level} badge />
          <RiskField label="Risiko pro Trade" value={`${settings.risk_per_trade}%`} />
          <RiskField label="Max. offene Positionen" value={settings.max_open_positions} />
          <RiskField label="Portfolio Exposure Cap" value={`${settings.portfolio_exposure_cap}%`} />
          <RiskField label="Tagesziel (Daily Profit KPI)" value={`${settings.daily_target}%`} />
          <RiskField label="Verluste bis Halbierung" value={settings.consecutive_losses_halve} />
          <RiskField label="Capital Priority" value={settings.capital_priority} badge />
          <RiskField label="High Leverage Mode" value={settings.high_leverage_mode} badge danger={settings.high_leverage_mode === "ENABLED"} />
        </div>
      </PanelCard>

      {/* Money Management */}
      <PanelCard title="Money Management – TP Level" className="mt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TpCard level="TP1" percent="40%" desc="Schließen + Stop auf Break-even" color="profit" />
          <TpCard level="TP2" percent="30%" desc="Schließen + Trailing Stop aktivieren" color="cyan" />
          <TpCard level="TP3" percent="30%" desc="Runner oder vollständiger Exit" color="primary" />
        </div>
      </PanelCard>

      {/* Risk Rules */}
      <PanelCard title="Automatische Risiko-Regeln" className="mt-4">
        <div className="space-y-3">
          <RuleRow
            icon={TrendingDown}
            text="Nach 2 aufeinanderfolgenden Verlusttraden: Risiko pro Trade halbieren"
            status="AKTIV"
          />
          <RuleRow
            icon={Shield}
            text="Bei Erreichen des Tagesverlustlimits (1.50%): Trading pausieren"
            status="AKTIV"
          />
          <RuleRow
            icon={Shield}
            text="Bei Erreichen des Max Drawdown (6.00%): Trading komplett stoppen"
            status="AKTIV"
          />
          <RuleRow
            icon={TrendingDown}
            text="Bei Erreichen des Tagesziels (2.0%): Risiko reduzieren oder Trading beenden"
            status="AKTIV"
          />
          <RuleRow
            icon={Lock}
            text="Kein Forced Trading – kein Trade ohne A+ Setup"
            status="AKTIV"
          />
          <RuleRow
            icon={ShieldAlert}
            text="High Leverage Mode standardmäßig DEAKTIVIERT – Governance-Freigabe nötig"
            status="GESPERRT"
            locked
          />
        </div>
      </PanelCard>
    </div>
  );
}

function RiskField({ label, value, badge = false, danger = false }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <StatusBadge status={value} color={danger ? "loss" : "primary"} />
      ) : (
        <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
      )}
    </div>
  );
}

function TpCard({ level, percent, desc, color }) {
  const colors = { profit: "text-profit border-profit/30 bg-profit/5", cyan: "text-primary border-primary/30 bg-primary/5", primary: "text-primary border-primary/30 bg-primary/5" };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-bold">{level}</span>
        <span className="font-mono text-2xl font-bold">{percent}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function RuleRow({ icon: Icon, text, status, locked = false }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${locked ? "text-loss" : "text-primary"}`} />
        <span className="text-sm text-foreground">{text}</span>
      </div>
      <StatusBadge status={status} color={locked ? "loss" : "profit"} />
    </div>
  );
}