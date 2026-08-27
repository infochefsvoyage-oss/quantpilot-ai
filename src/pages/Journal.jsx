import React from "react";
import { BookOpen, Target } from "lucide-react";
import { journalEntries, formatPnl } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function Journal() {
  const sorted = [...journalEntries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Daily Performance Journal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Tägliche Reflexion – Disziplin & Money-Management-Einhaltung</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(() => {
          const totalPnl = journalEntries.reduce((s, e) => s + e.daily_pnl, 0);
          const totalTrades = journalEntries.reduce((s, e) => s + e.trades_count, 0);
          const totalWins = journalEntries.reduce((s, e) => s + e.wins, 0);
          const avgWinRate = journalEntries.reduce((s, e) => s + e.win_rate, 0) / journalEntries.length;
          return (
            <>
              <JournalStat label="Gesamt PnL (3 Tage)" value={formatPnl(totalPnl)} unit="USDT" color={totalPnl >= 0 ? "profit" : "loss"} />
              <JournalStat label="Trades gesamt" value={totalTrades} unit={`${totalWins} Gewinne`} />
              <JournalStat label="Ø Win Rate" value={`${avgWinRate.toFixed(1)}%`} color={avgWinRate >= 50 ? "profit" : "loss"} />
              <JournalStat label="Tagesziel Treffer" value={journalEntries.filter((e) => e.daily_target_hit).length} unit={`von ${journalEntries.length} Tagen`} color="primary" />
            </>
          );
        })()}
      </div>

      {/* Daily Entries */}
      <div className="mt-4 space-y-4">
        {sorted.map((entry) => {
          const pnlPositive = entry.daily_pnl >= 0;
          return (
            <PanelCard
              key={entry.id}
              title={new Date(entry.date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              action={entry.daily_target_hit ? <StatusBadge status="ZIEL ERREICHT" color="profit" /> : <StatusBadge status="ZIEL OFFEN" color="muted" />}
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                <MetricBox label="Trades" value={entry.trades_count} />
                <MetricBox label="Win Rate" value={`${entry.win_rate}%`} color={entry.win_rate >= 50 ? "profit" : "loss"} />
                <MetricBox label="Tages-PnL" value={formatPnl(entry.daily_pnl)} unit={`${formatPnl(entry.daily_pnl_percent)}%`} color={pnlPositive ? "profit" : "loss"} />
                <MetricBox label="Max DD" value={`${entry.max_drawdown}%`} color="warning" />
                <MetricBox label="Gate-Erfolg" value={`${entry.gate_success_rate}%`} color={entry.gate_success_rate >= 75 ? "profit" : "warning"} />
                <MetricBox label="ULF Warnungen" value={entry.ulf_warnings} color={entry.ulf_warnings > 2 ? "loss" : "muted"} />
              </div>
              <div className="mt-4 flex items-start gap-2">
                <div className="flex items-center gap-2">
                  {entry.mm_compliance ? (
                    <StatusBadge status="MM EINGEHALTEN" color="profit" />
                  ) : (
                    <StatusBadge status="MM VERLETZT" color="loss" />
                  )}
                </div>
                <p className="flex-1 text-sm text-muted-foreground italic">„{entry.notes}"</p>
              </div>
            </PanelCard>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Target className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-warning">Daily Profit ist ein Ziel-KPI, kein Versprechen.</span>{" "}
            Das Journal dokumentiert reale Performance – gute und schlechte Tage. Disziplin schlägt kurzfristige Gewinne.
          </p>
        </div>
      </div>
    </div>
  );
}

function JournalStat({ label, value, unit = "", color = "muted" }) {
  const colors = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", primary: "text-primary" };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-xl font-bold ${colors[color]}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

function MetricBox({ label, value, unit = "", color = "muted" }) {
  const colors = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", primary: "text-primary", warning: "text-warning" };
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${colors[color]}`}>{value}</div>
      {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
    </div>
  );
}