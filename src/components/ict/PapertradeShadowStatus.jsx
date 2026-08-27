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
        // Prefer combined audit log (has all metrics in one record)
        const extendedLogs = (logs || []).filter(
          (l) => l.event === "PAPERTRADE_SHADOW_EXTENDED_RUN_V3" ||
                   l.event === "PAPERTRADE_SHADOW_EXTENDED_RUN_V2" ||
                   l.event === "PAPERTRADE_SHADOW_EXTENDED_RUN"
        );
        const combinedLogs = (logs || []).filter(
          (l) => l.event === "PAPERTRADE_SHADOW_COMBINED_AUDIT"
        );
        const auditLogs = (logs || []).filter(
          (l) => l.event === "PAPERTRADE_SHADOW_TRADE_AUDIT"
        );
        const runLogs = (logs || []).filter(
          (l) => l.event === "PAPERTRADE_SHADOW_RUN"
        );
        let latest = extendedLogs[0] || combinedLogs[0] || auditLogs[0] || runLogs[0] || null;
        if (latest) {
          latest = await base44.entities.AuditLog.get(latest.id);
        }
        if (active) { setData(latest); setLoading(false); }
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

  // Audit-level metrics (from PAPERTRADE_SHADOW_TRADE_AUDIT)
  const rDist = m.r_distribution || {};
  const mfeStats = m.mfe_stats || {};
  const maeStats = m.mae_stats || {};
  const timeStats = m.time_in_trade_stats || {};
  const bootstrap = m.bootstrap || {};
  const stdDevR = rDist.std_dev ?? 0;
  const minR = rDist.min ?? 0;
  const maxR = rDist.max ?? 0;
  const q1R = rDist.q1 ?? 0;
  const q3R = rDist.q3 ?? 0;
  const recoveryTime = m.recovery_time_trades ?? 0;
  const avgMFE = mfeStats.avg ?? 0;
  const medianMFE = mfeStats.median ?? 0;
  const avgMAE = maeStats.avg ?? 0;
  const medianMAE = maeStats.median ?? 0;
  const avgTimeInTrade = timeStats.avg ?? 0;
  const bootstrapCI = bootstrap.ci_95 || [0, 0];
  const bootstrapMean = bootstrap.mean ?? 0;
  const probPositive = bootstrap.prob_positive ?? 0;
  const sampleSize = m.sample_size || closedTrades;
  const isSmallSample = m.small_sample ?? (sampleSize < 30);
  const rReconciliation = m.r_reconciliation || "N/A";
  const equityCurveCheck = m.equity_curve_check || "N/A";
  const hasAudit = data?.event === "PAPERTRADE_SHADOW_TRADE_AUDIT" || data?.event === "PAPERTRADE_SHADOW_COMBINED_AUDIT" || data?.event?.startsWith("PAPERTRADE_SHADOW_EXTENDED_RUN");
  const hasExtended = !!(data?.event?.startsWith("PAPERTRADE_SHADOW_EXTENDED_RUN"));
  const dataClass = m.data_class || "HISTORICAL_SHADOW";
  const isOos = m.is_oos || false;
  const shadowAfterDiscovery = m.shadow_after_discovery || false;
  const integrityGate = m.integrity_gate || {};
  const temporalIntegrity = m.temporal_integrity || "N/A";
  const strategyDataIntegrity = m.strategy_data_integrity || {};
  const discoveryEnd = m.discovery_end || null;
  const shadowStart = m.shadow_start || m.start_time || null;
  const shadowEnd = m.shadow_end || m.end_time || null;
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

      {/* DATA CLASS Banner */}
      <div className={`mb-3 rounded-md border px-3 py-2.5 ${isOos ? "border-profit/30 bg-profit/5" : "border-warning/30 bg-warning/10"}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            DATA CLASS
          </span>
          <span className={`font-mono text-sm font-bold ${isOos ? "text-profit" : "text-warning"}`}>
            {dataClass === "INDEPENDENT_OOS" ? "INDEPENDENT OOS" : "HISTORICAL SHADOW · NOT INDEPENDENT OOS"}
          </span>
        </div>
        {hasExtended && shadowStart && shadowEnd && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div className="rounded border border-border bg-secondary/30 px-2 py-1">
              <span className="text-muted-foreground">Discovery End</span>
              <div className="font-mono font-semibold text-foreground">{discoveryEnd ? new Date(discoveryEnd).toLocaleDateString("de-DE") : "—"}</div>
            </div>
            <div className="rounded border border-border bg-secondary/30 px-2 py-1">
              <span className="text-muted-foreground">Shadow Start</span>
              <div className="font-mono font-semibold text-foreground">{shadowStart ? new Date(shadowStart).toLocaleDateString("de-DE") : "—"}</div>
            </div>
            <div className="rounded border border-border bg-secondary/30 px-2 py-1">
              <span className="text-muted-foreground">Shadow End</span>
              <div className="font-mono font-semibold text-foreground">{shadowEnd ? new Date(shadowEnd).toLocaleDateString("de-DE") : "—"}</div>
            </div>
            <div className="rounded border border-border bg-secondary/30 px-2 py-1">
              <span className="text-muted-foreground">Shadow After Discovery</span>
              <div className={`font-mono font-semibold ${shadowAfterDiscovery ? "text-profit" : "text-warning"}`}>
                {shadowAfterDiscovery ? "TRUE" : "FALSE (OVERLAP)"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Integrity Gate */}
      {hasExtended && (
        <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
          <div className="mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Integrity Gate</span>
            <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-bold ${integrityGate.pass ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
              {integrityGate.pass ? "PASS" : "FAIL"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <IntegrityItem label="Chronological" value={integrityGate.chronological ? "TRUE" : "FALSE"} color={integrityGate.chronological ? "profit" : "loss"} />
            <IntegrityItem label="Duplicates (raw)" value={`${integrityGate.duplicates_removed ?? 0}`} color="muted" />
            <IntegrityItem label="OHLC Valid" value={integrityGate.ohlc_valid ? "TRUE" : "FALSE"} color={integrityGate.ohlc_valid ? "profit" : "loss"} />
            <IntegrityItem label="No Future Data" value={integrityGate.no_future_data ? "TRUE" : "FALSE"} color={integrityGate.no_future_data ? "profit" : "loss"} />
            <IntegrityItem label="Symbol" value={integrityGate.symbol || "XAUUSD"} color="profit" />
            <IntegrityItem label="Timeframe" value={integrityGate.timeframe_match ? "M1 OK" : "M1 FAIL"} color={integrityGate.timeframe_match ? "profit" : "loss"} />
            <IntegrityItem label="Temporal Integrity" value={temporalIntegrity} color={temporalIntegrity === "PASS" ? "profit" : "loss"} />
            <IntegrityItem label="Strategy Version" value={strategyDataIntegrity.match ? "MATCH" : "MISMATCH"} color={strategyDataIntegrity.match ? "profit" : "loss"} />
          </div>
        </div>
      )}

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

      {/* R-Distribution (Audit) */}
      {hasAudit && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBox icon={Activity} label="Std Dev R" value={stdDevR} sub="Volatilität" color="warning" />
          <StatBox icon={TrendingDown} label="Min R" value={`${minR}R`} sub="schlechtester Trade" color="loss" />
          <StatBox icon={TrendingUp} label="Max R" value={`+${maxR}R`} sub="bester Trade" color="profit" />
          <StatBox icon={Activity} label="Recovery Time" value={`${recoveryTime} Trades`} sub="DD → Peak" color="muted" />
        </div>
      )}

      {/* MFE / MAE (Audit) */}
      {hasAudit && (
        <>
          <div className="mt-4 border-t border-border pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">MFE / MAE Analyse (Diagnose — keine Parameteränderung)</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox icon={TrendingUp} label="Avg MFE" value={`+${avgMFE}R`} sub="Maximum Favorable Excursion" color="profit" />
            <StatBox icon={TrendingUp} label="Median MFE" value={`+${medianMFE}R`} sub="" color="profit" />
            <StatBox icon={TrendingDown} label="Avg MAE" value={`-${avgMAE}R`} sub="Maximum Adverse Excursion" color="loss" />
            <StatBox icon={TrendingDown} label="Median MAE" value={`-${medianMAE}R`} sub="" color="loss" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox icon={Clock} label="Avg Time in Trade" value={`${avgTimeInTrade} Bars`} sub="M1 Candles" color="muted" />
            <StatBox icon={TrendingUp} label="MFE Winners" value={`+${mfeStats.winners_avg ?? 0}R`} sub="Gewinner MFE" color="profit" />
            <StatBox icon={TrendingDown} label="MAE Losers" value={`-${maeStats.losers_avg ?? 0}R`} sub="Verlierer MAE" color="loss" />
            <StatBox icon={Activity} label="Q1 / Q3 R" value={`${q1R} / ${q3R}R`} sub="Quartile" color="muted" />
          </div>
        </>
      )}

      {/* Bootstrap (Audit) */}
      {hasAudit && (
        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Bootstrap (10.000 Resamples)</span>
            <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">SHADOW DATA · NOT INDEPENDENT OOS</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox icon={Activity} label="Bootstrap Mean" value={`+${bootstrapMean}R`} sub="resampled" color={bootstrapMean > 0 ? "profit" : "loss"} />
            <StatBox icon={Activity} label="95% CI" value={`[${bootstrapCI[0]}, ${bootstrapCI[1]}]`} sub="R-Erwwartung" color={bootstrapCI[0] > 0 ? "profit" : "warning"} />
            <StatBox icon={TrendingUp} label="P(positive)" value={`${(probPositive * 100).toFixed(1)}%`} sub="Wahrscheinlichkeit" color={probPositive > 0.5 ? "profit" : "loss"} />
            <StatBox icon={Activity} label="Equity Check" value={equityCurveCheck} sub="Total R / Max DD" color={equityCurveCheck === "PASS" ? "profit" : "loss"} />
          </div>
        </div>
      )}

      {/* Small Sample Warning */}
      {hasAudit && isSmallSample && (
        <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-warning">SMALL SAMPLE — N = {sampleSize}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Keine statistische Signifikanz ableitbar. Kein "ROBUST EDGE" oder "STATISTICALLY CONFIRMED". Ergebnisse dienen ausschließlich der technischen Verifikation der Execution-Pipeline.
              </p>
            </div>
          </div>
        </div>
      )}

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
        <IntegrityItem label="R-Reconciliation" value={rReconciliation} color={rReconciliation === "PASS" ? "profit" : rReconciliation === "FAIL" ? "loss" : "muted"} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <IntegrityItem label="Governance" value={governance} color={governance === "PASS" ? "profit" : "loss"} />
        <IntegrityItem label="Equity Curve" value={equityCurveCheck} color={equityCurveCheck === "PASS" ? "profit" : equityCurveCheck === "FAIL" ? "loss" : "muted"} />
        <IntegrityItem label="Sample Size" value={`${sampleSize}`} color={isSmallSample ? "warning" : "profit"} />
        <IntegrityItem label="Small Sample" value={isSmallSample ? "TRUE" : "FALSE"} color={isSmallSample ? "warning" : "profit"} />
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

function StatBox({ icon: Icon = null, label, value, sub = "", color = "muted" }) {
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

function MetaItem({ label, value, mono = false }) {
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