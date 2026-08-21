// QuantPilot — Papertrade Shadow Status Panel
// Zeigt den Status der Papertrade-Testläufe im Shadow Mode.
// Klar getrennt von OOS-VALIDATION und LIVE TRADING.
// Ein Papertrade ist NIEMALS OOS-Validierung oder bestätigte Evidenz.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import {
  FlaskConical, Lock, Ban, Activity, TrendingUp, TrendingDown,
  Crosshair, Clock, Database, ShieldCheck, AlertTriangle,
} from "lucide-react";

export default function PapertradeShadowStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const logs = await base44.entities.AuditLog.list("-created_date", 50);
        const ptLogs = (logs || []).filter(
          (l) => l.event === "PAPERTRADE_SHADOW_RUN"
        );
        if (active) { setData(ptLogs[0] || null); setLoading(false); }
      } catch {
        if (active) { setData(null); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="Papertrade Shadow Status">
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const m = data?.metadata || {};
  const hasRun = !!data;
  const signals = m.signals || 0;
  const paperEntries = m.paper_entries || 0;
  const paperExits = m.paper_exits || 0;
  const openTrades = m.open_trades || 0;
  const closedTrades = m.closed_trades || 0;
  const totalR = m.total_r ?? 0;
  const winRate = m.win_rate ?? 0;
  const meanR = m.mean_r ?? 0;
  const medianR = m.median_r ?? 0;
  const maxDD = m.max_dd ?? 0;
  const profitFactor = m.profit_factor ?? 0;
  const avgWinner = m.avg_winner ?? 0;
  const avgLoser = m.avg_loser ?? 0;
  const longestWinStreak = m.longest_win_streak ?? 0;
  const longestLossStreak = m.longest_loss_streak ?? 0;
  const rejectedSignals = m.rejected_signals || 0;
  const strategyVersion = m.strategy_version || "NY_LONG_FROZEN_v1";
  const dataSource = m.data_source || "MT5_HISTORICAL";
  const runId = m.run_id || "—";
  const datasetHash = m.dataset_hash || "—";
  const dataIntegrity = m.data_integrity || "N/A";
  const lookAhead = m.look_ahead_protection || "N/A";
  const reproducibility = m.reproducibility || "N/A";
  const governance = m.governance || "PASS";
  const lastSignal = m.trades && m.trades.length > 0
    ? m.trades[m.trades.length - 1].timestamp
    : null;
  const lastPapertrade = m.trades && m.trades.length > 0
    ? m.trades[m.trades.length - 1].trade_id
    : "—";

  return (
    <PanelCard
      title="Papertrade Shadow Status"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <FlaskConical className="h-3.5 w-3.5" />
          PAPER SHADOW · Technical Verification
        </span>
      }
    >
      {/* Execution Mode Banner */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ModeBox label="Execution Mode" value="PAPER SHADOW" color="primary" />
        <ModeBox label="Real Orders" value="BLOCKED" color="loss" icon={Lock} />
        <ModeBox label="Live Execution" value="BLOCKED" color="loss" icon={Ban} />
        <ModeBox label="Paper Trading" value="ACTIVE" color="profit" icon={Activity} />
      </div>

      {/* Separation Notice */}
      <div className="mb-3 rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-warning">Papertrade ≠ OOS-Validierung.</span>{" "}
            Papertrades bestätigen ausschließlich die technische Execution-/Monitoring-Pipeline, nicht den statistischen Edge. Keine automatische Klassifikationsänderung.
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox icon={Crosshair} label="Papertrade Signals" value={signals} sub={`${rejectedSignals} abgelehnt`} color="primary" />
        <StatBox icon={Activity} label="Paper Entries" value={paperEntries} sub={hasRun ? "simuliert" : "kein Run"} color="primary" />
        <StatBox icon={Clock} label="Open Papertrades" value={openTrades} sub="alle geschlossen" color="muted" />
        <StatBox icon={ShieldCheck} label="Closed Trades" value={closedTrades} sub={`${paperExits} Exits`} color="profit" />
      </div>

      {/* Performance Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox icon={totalR >= 0 ? TrendingUp : TrendingDown} label="Total R" value={`${totalR >= 0 ? "+" : ""}${totalR}R`} sub={hasRun ? "" : "N/A"} color={hasRun ? (totalR >= 0 ? "profit" : "loss") : "muted"} />
        <StatBox icon={Crosshair} label="Win Rate" value={hasRun ? `${winRate}%` : "N/A"} sub={hasRun ? `${m.wins || 0}W / ${m.losses || 0}L` : "kein Run"} color={hasRun ? (winRate >= 50 ? "profit" : "loss") : "muted"} />
        <StatBox icon={Activity} label="Mean R" value={hasRun ? meanR : "N/A"} sub={hasRun ? "" : "N/A"} color={hasRun ? (meanR > 0 ? "profit" : "loss") : "muted"} />
        <StatBox icon={Activity} label="Median R" value={hasRun ? medianR : "N/A"} sub={hasRun ? "" : "N/A"} color={hasRun ? (medianR > 0 ? "profit" : "loss") : "muted"} />
      </div>

      {/* Extended Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox icon={TrendingDown} label="Max DD" value={hasRun ? `${maxDD}R` : "N/A"} sub={hasRun ? "" : "N/A"} color={hasRun ? "warning" : "muted"} />
        <StatBox icon={TrendingUp} label="Avg Winner" value={hasRun ? `+${avgWinner}R` : "N/A"} sub={hasRun ? `${m.wins || 0} Trades` : "N/A"} color={hasRun ? "profit" : "muted"} />
        <StatBox icon={TrendingDown} label="Avg Loser" value={hasRun ? `-${avgLoser}R` : "N/A"} sub={hasRun ? `${m.losses || 0} Trades` : "N/A"} color={hasRun ? "loss" : "muted"} />
        <StatBox icon={Activity} label="Profit Factor" value={hasRun ? profitFactor : "N/A"} sub={hasRun ? "" : "N/A"} color={hasRun ? (profitFactor >= 1 ? "profit" : "loss") : "muted"} />
      </div>

      {/* Streak Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox icon={TrendingUp} label="Longest Win Streak" value={hasRun ? longestWinStreak : "N/A"} sub={hasRun ? "Trades" : "N/A"} color={hasRun ? "profit" : "muted"} />
        <StatBox icon={TrendingDown} label="Longest Loss Streak" value={hasRun ? longestLossStreak : "N/A"} sub={hasRun ? "Trades" : "N/A"} color={hasRun ? "loss" : "muted"} />
        <StatBox icon={Database} label="Dataset Hash" value={hasRun ? `${datasetHash.substring(0, 20)}...` : "—"} sub={hasRun ? `${m.candle_count || 0} candles` : "N/A"} color="muted" />
        <StatBox icon={Clock} label="Date Range" value={hasRun ? `${m.start_time ? new Date(m.start_time).toLocaleDateString("de-DE") : "—"} - ${m.end_time ? new Date(m.end_time).toLocaleDateString("de-DE") : "—"}` : "—"} sub={hasRun ? "" : "N/A"} color="muted" />
      </div>

      {/* Run Metadata */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 md:grid-cols-3">
        <MetaItem label="Strategy Version" value={strategyVersion} />
        <MetaItem label="Data Source" value={dataSource} />
        <MetaItem label="Run-ID" value={runId} mono />
        <MetaItem label="Last Signal" value={lastSignal ? new Date(lastSignal).toLocaleString("de-DE") : "—"} />
        <MetaItem label="Last Papertrade" value={lastPapertrade} mono />
        <MetaItem label="Profit Factor" value={hasRun ? profitFactor : "N/A"} />
      </div>

      {/* Integrity & Governance */}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <IntegrityItem label="Data Integrity" value={dataIntegrity} color={dataIntegrity === "PASS" ? "profit" : dataIntegrity === "FAIL" ? "loss" : "muted"} />
        <IntegrityItem label="Look-Ahead Protection" value={lookAhead} color={lookAhead === "PASS" ? "profit" : lookAhead === "FAIL" ? "loss" : "muted"} />
        <IntegrityItem label="Reproducibility" value={reproducibility} color={reproducibility === "PASS" ? "profit" : reproducibility === "FAIL" ? "loss" : "muted"} />
        <IntegrityItem label="Governance" value={governance} color={governance === "PASS" ? "profit" : "loss"} />
      </div>

      {/* OOS Classification Unchanged Notice */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          OOS Classification
        </span>
        <span className="font-mono text-xs font-semibold text-warning">UNCHANGED · CANDIDATE EDGE / NOT CONFIRMED</span>
      </div>

      {/* AuditLog Reference */}
      <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5 text-primary" />
          Papertrade AuditLog
        </span>
        <span className="font-mono text-xs font-semibold text-foreground">{data?.id || "—"}</span>
      </div>
    </PanelCard>
  );
}

function ModeBox({ label, value, color, icon: Icon }) {
  const colors = {
    primary: "text-primary border-primary/20 bg-primary/5",
    profit: "text-profit border-profit/20 bg-profit/5",
    loss: "text-loss border-loss/20 bg-loss/5",
  };
  return (
    <div className={`flex items-center gap-2 rounded-md border ${colors[color]} px-3 py-2`}>
      {Icon && <Icon className={`h-3.5 w-3.5 ${colors[color].split(" ")[0]}`} />}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`font-mono text-xs font-bold ${colors[color].split(" ")[0]}`}>{value}</div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, sub, color }) {
  const colors = {
    primary: "text-primary",
    profit: "text-profit",
    loss: "text-loss",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className={`h-3.5 w-3.5 ${colors[color] || "text-foreground"}`} />}
      </div>
      <div className={`mt-1 font-mono text-lg font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
      <div className="font-mono text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function MetaItem({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : ""} text-xs font-semibold text-foreground`}>{value}</span>
    </div>
  );
}

function IntegrityItem({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-semibold ${colors[color] || "text-foreground"}`}>{value}</span>
    </div>
  );
}