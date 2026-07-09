import React, { useState } from "react";
import { Shield, TrendingUp, Anchor, Activity, AlertTriangle, MessageCircle, ScrollText } from "lucide-react";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import { runnerPositions, runnerAuditLogs, runnerStatusMeta } from "@/lib/extendedData";
import { formatPrice, formatPnl } from "@/lib/quantData";

export default function RunnerProtection() {
  const [selected, setSelected] = useState(runnerPositions[0]);

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Runner-Protection
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dynamische Trailing-Stops, Break-Even-Management, Teilgewinn-Logik & Volatilitätsbasierte Stop-Anpassung
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Runner List */}
        <div className="lg:col-span-1">
          <PanelCard title="Aktive Runner">
            <div className="space-y-3">
              {runnerPositions.map((pos) => {
                const meta = runnerStatusMeta[pos.status];
                const isActive = selected?.id === pos.id;
                return (
                  <button
                    key={pos.id}
                    onClick={() => setSelected(pos)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isActive ? "border-primary bg-primary/5 glow-cyan" : "border-border bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-foreground">{pos.symbol}</span>
                      <StatusBadge status={meta.label} color={meta.color} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{pos.exchange} · {pos.side}</span>
                      <span className={`font-mono font-semibold ${pos.unrealized_pnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatPnl(pos.unrealized_pnl)} USDT
                      </span>
                    </div>
                    {pos.status === "PENDING_ADOPTION" && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Adoption wartet auf Governance</span>
                      </div>
                    )}
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
              {/* Position Header */}
              <PanelCard title={`Runner: ${selected.symbol}`}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Metric label="Entry" value={formatPrice(selected.entry_price)} color="foreground" />
                  <Metric label="Aktueller Preis" value={formatPrice(selected.current_price)} color={selected.unrealized_pnl >= 0 ? "profit" : "loss"} />
                  <Metric label="Trailing Stop" value={formatPrice(selected.current_trailing_stop)} color="warning" />
                  <Metric label="Unrealized PnL" value={`${formatPnl(selected.unrealized_pnl)} USDT`} color={selected.unrealized_pnl >= 0 ? "profit" : "loss"} />
                </div>
              </PanelCard>

              {/* TP Ladder */}
              <PanelCard title="Take-Profit Leiter & Teilgewinn-Logik" className="mt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <TpLevel
                    level="TP1" price={selected.tp1_price} closePercent={selected.tp1_close_percent}
                    filled={selected.tp1_filled} color="profit"
                  />
                  <TpLevel
                    level="TP2" price={selected.tp2_price} closePercent={selected.tp2_close_percent}
                    filled={selected.tp2_filled} color="cyan"
                  />
                  <TpLevel
                    level="TP3 Runner" price={selected.tp3_price} closePercent={selected.tp3_close_percent}
                    filled={selected.tp3_filled} color="warning"
                  />
                </div>
                <div className="mt-4 rounded-md border border-border bg-secondary/30 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Verbleibende Position</span>
                    <span className="font-mono font-bold text-foreground">{selected.remaining_size_percent}%</span>
                  </div>
                </div>
              </PanelCard>

              {/* Protection Status */}
              <PanelCard title="Schutz-Mechanismen" className="mt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ProtectionRow icon={Anchor} label="Break-Even aktiviert" active={selected.break_even_activated} value={selected.break_even_activated ? `@ ${formatPrice(selected.break_even_price)}` : "Inaktiv"} />
                  <ProtectionRow icon={TrendingUp} label="Trailing Stop Modus" active={selected.stop_adjustment_mode !== "FIXED"} value={selected.stop_adjustment_mode} />
                  <ProtectionRow icon={Activity} label="Volatilität (ATR)" active={selected.volatility_atr_percent < 3} value={`${selected.volatility_atr_percent.toFixed(1)}%`} />
                  <ProtectionRow icon={Shield} label="Adoption freigegeben" active={selected.adoption_governance_approved} value={selected.adoption_governance_approved ? "Governance OK" : "Ausstehend"} />
                </div>
              </PanelCard>

              {/* Telegram Alerts */}
              <PanelCard title="Telegram Alerts" className="mt-4" action={<MessageCircle className="h-4 w-4 text-primary" />}>
                <div className="space-y-2">
                  <AlertRow message={`Runner ${selected.symbol} adoptiert`} sent={selected.is_adopted} />
                  <AlertRow message={`TP1 getroffen @ ${formatPrice(selected.tp1_price)}`} sent={selected.tp1_filled} />
                  <AlertRow message={`Trailing Stop angepasst @ ${formatPrice(selected.current_trailing_stop)}`} sent={selected.telegram_alert_sent} />
                  <AlertRow message={`Break-Even aktiviert`} sent={selected.break_even_activated} />
                </div>
              </PanelCard>
            </>
          )}
        </div>
      </div>

      {/* Audit Logs */}
      <PanelCard title="Runner Audit-Logs" className="mt-4" action={<ScrollText className="h-4 w-4 text-muted-foreground" />}>
        <div className="space-y-2">
          {runnerAuditLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 px-4 py-2.5">
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                log.severity === "CRITICAL" ? "bg-loss" : log.severity === "WARNING" ? "bg-warning" : "bg-primary"
              }`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-foreground">{log.action}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleString("de-DE")}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

function Metric({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", warning: "text-warning", foreground: "text-foreground" };
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}

function TpLevel({ level, price, closePercent, filled, color }) {
  const colors = {
    profit: filled ? "border-profit bg-profit/10 text-profit" : "border-profit/30 text-profit",
    cyan: filled ? "border-primary bg-primary/10 text-primary" : "border-primary/30 text-primary",
    warning: filled ? "border-warning bg-warning/10 text-warning" : "border-warning/30 text-warning",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{level}</span>
        <span className="font-mono text-xs">{filled ? "✓ AUSGEFÜHRT" : "OFFEN"}</span>
      </div>
      <div className="mt-2 font-mono text-lg font-bold">{formatPrice(price)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{closePercent}% schließen</div>
    </div>
  );
}

function ProtectionRow({ icon: Icon, label, active, value }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Icon className={`h-4 w-4 ${active ? "text-profit" : "text-muted-foreground"}`} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
        <span className={`h-2 w-2 rounded-full ${active ? "bg-profit" : "bg-muted-foreground"}`} />
      </div>
    </div>
  );
}

function AlertRow({ message, sent }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-2.5">
      <span className="text-xs text-foreground">{message}</span>
      <StatusBadge status={sent ? "GESENDET" : "OFFEN"} color={sent ? "profit" : "muted"} />
    </div>
  );
}