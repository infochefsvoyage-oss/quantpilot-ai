// QuantPilot Live Performance Monitor (Phase 14)
// Zeigt Live-Performance-Metriken klar getrennt von RESEARCH und PAPER.
// Keine Vermischung der Statistiken. LIVE_EXECUTION = BLOCKED bis alle Gates bestehen.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { Activity, Radio, ShieldCheck, Lock, Zap, Clock, Server } from "lucide-react";

export default function LivePerformanceMonitor() {
  const [trades, setTrades] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, s] = await Promise.all([
          base44.entities.Trade.list("-created_date", 100),
          base44.entities.MT5DataSnapshot.list("-created_date", 10),
        ]);
        if (active) { setTrades(t || []); setSnapshots(s || []); setLoading(false); }
      } catch {
        if (active) { setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  // Separate trades by mode
  const liveTrades = trades.filter(t => t.mode === "LIVE");
  const paperTrades = trades.filter(t => t.mode === "PAPER");
  const shadowTrades = trades.filter(t => t.mode === "SHADOW");

  const now = Date.now();
  const dayMs = 86400000;
  const todayTrades = liveTrades.filter(t => now - new Date(t.created_date).getTime() < dayMs);
  const weekTrades = liveTrades.filter(t => now - new Date(t.created_date).getTime() < 7 * dayMs);
  const monthTrades = liveTrades.filter(t => now - new Date(t.created_date).getTime() < 30 * dayMs);

  const sumR = (arr) => arr.reduce((s, t) => s + (t.realized_pnl || 0), 0);
  const calcWR = (arr) => {
    const decided = arr.filter(t => t.status === "closed");
    if (decided.length === 0) return 0;
    return Math.round((decided.filter(t => (t.realized_pnl || 0) > 0).length / decided.length) * 1000) / 10;
  };
  const calcPF = (arr) => {
    const wins = arr.filter(t => (t.realized_pnl || 0) > 0).reduce((s, t) => s + (t.realized_pnl || 0), 0);
    const losses = Math.abs(arr.filter(t => (t.realized_pnl || 0) < 0).reduce((s, t) => s + (t.realized_pnl || 0), 0));
    return losses > 0 ? Math.round((wins / losses) * 100) / 100 : wins > 0 ? 99 : 0;
  };
  const calcMaxDD = (arr) => {
    let eq = 0, peak = 0, maxDD = 0;
    for (const t of arr) { eq += (t.realized_pnl || 0); if (eq > peak) peak = eq; const dd = peak - eq; if (dd > maxDD) maxDD = dd; }
    return Math.round(maxDD * 100) / 100;
  };
  const calcLossStreak = (arr) => {
    let streak = 0, max = 0;
    for (const t of arr) {
      if ((t.realized_pnl || 0) < 0) { streak++; max = Math.max(max, streak); }
      else streak = 0;
    }
    return max;
  };

  const latestSnap = snapshots[0] || {};
  const heartbeatState = latestSnap.heartbeat_state || "STALE";
  const bridgeLatency = latestSnap.ingestion_latency_ms || 0;
  const tickFresh = latestSnap.tick_fresh;
  const accountFresh = latestSnap.account_fresh;
  const positionsFresh = latestSnap.positions_fresh;

  const liveMetrics = {
    today_r: sumR(todayTrades),
    week_r: sumR(weekTrades),
    month_r: sumR(monthTrades),
    wr: calcWR(liveTrades),
    pf: calcPF(liveTrades),
    expectancy: liveTrades.length > 0 ? Math.round((sumR(liveTrades) / liveTrades.length) * 100) / 100 : 0,
    max_dd: calcMaxDD(liveTrades),
    current_dd: 0,
    loss_streak: calcLossStreak(liveTrades),
    trades: liveTrades.length,
  };

  if (loading) {
    return (
      <PanelCard title="QuantPilot Live Performance">
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="QuantPilot Live Performance"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-loss/10 px-2.5 py-1 text-xs font-medium text-loss">
          <Lock className="h-3.5 w-3.5" />
          LIVE EXECUTION: BLOCKED
        </span>
      }
    >
      {/* Mode Separation Banner */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <ModeBox label="RESEARCH" count={shadowTrades.length} color="primary" active={false} />
        <ModeBox label="PAPER" count={paperTrades.length} color="warning" active={false} />
        <ModeBox label="LIVE" count={liveTrades.length} color="loss" active={false} />
      </div>
      <div className="mb-3 rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-warning">Statistiken strikt getrennt.</span>{" "}
          Keine Vermischung von Research-, Paper- und Live-Ergebnissen. Live-Modus erst nach allen Gates.
        </p>
      </div>

      {/* Live Performance Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricBox label="Today R" value={`${liveMetrics.today_r >= 0 ? "+" : ""}${liveMetrics.today_r}R`} color={liveMetrics.today_r >= 0 ? "profit" : "loss"} />
        <MetricBox label="Week R" value={`${liveMetrics.week_r >= 0 ? "+" : ""}${liveMetrics.week_r}R`} color={liveMetrics.week_r >= 0 ? "profit" : "loss"} />
        <MetricBox label="Month R" value={`${liveMetrics.month_r >= 0 ? "+" : ""}${liveMetrics.month_r}R`} color={liveMetrics.month_r >= 0 ? "profit" : "loss"} />
        <MetricBox label="Live WR" value={`${liveMetrics.wr}%`} color="warning" />
        <MetricBox label="Live PF" value={liveMetrics.pf} color={liveMetrics.pf > 1 ? "profit" : "loss"} />
        <MetricBox label="Expectancy" value={`${liveMetrics.expectancy}R`} color={liveMetrics.expectancy > 0 ? "profit" : "loss"} />
        <MetricBox label="Max DD" value={`${liveMetrics.max_dd}R`} color="loss" />
        <MetricBox label="Loss Streak" value={liveMetrics.loss_streak} color="warning" />
      </div>

      {/* Execution Pipeline Status */}
      <div className="mt-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Execution Pipeline</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <PipelineItem icon={Activity} label="Heartbeat" value={heartbeatState} color={heartbeatState === "HEALTHY" ? "profit" : "loss"} />
          <PipelineItem icon={Radio} label="Tick Freshness" value={tickFresh ? "PASS" : "FAIL"} color={tickFresh ? "profit" : "loss"} />
          <PipelineItem icon={ShieldCheck} label="Account Sync" value={accountFresh ? "100%" : "FAIL"} color={accountFresh ? "profit" : "loss"} />
          <PipelineItem icon={ShieldCheck} label="Position Sync" value={positionsFresh ? "100%" : "FAIL"} color={positionsFresh ? "profit" : "loss"} />
          <PipelineItem icon={Server} label="Bridge" value={latestSnap.bridge_tier || "UI_CONTRACT"} color="muted" />
          <PipelineItem icon={Clock} label="Bridge Latency" value={`${bridgeLatency}ms`} color={bridgeLatency < 500 ? "profit" : "warning"} />
          <PipelineItem icon={Activity} label="Trades" value={liveMetrics.trades} color="muted" />
          <PipelineItem icon={Lock} label="Order Send" value="BLOCKED" color="loss" />
        </div>
      </div>

      {/* Safety Gates */}
      <div className="mt-3 rounded-md border border-loss/20 bg-loss/5 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-loss" />
          <span className="text-xs font-semibold text-loss">Hard Safety Gates</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <GateItem label="Heartbeat" value="BLOCKED" />
          <GateItem label="Tick Fresh" value="BLOCKED" />
          <GateItem label="Account sync" value="BLOCKED" />
          <GateItem label="Position sync" value="BLOCKED" />
          <GateItem label="Bridge" value="BLOCKED" />
          <GateItem label="Emergency Kill" value="ARMED" />
        </div>
      </div>
    </PanelCard>
  );
}

function ModeBox({ label, count, color, active }) {
  const colors = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    warning: "border-warning/30 bg-warning/5 text-warning",
    loss: "border-loss/30 bg-loss/5 text-loss",
  };
  return (
    <div className={`rounded-md border px-3 py-2 text-center ${colors[color]}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{count}</div>
    </div>
  );
}

function MetricBox({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", warning: "text-warning", muted: "text-muted-foreground" };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}

function PipelineItem({ icon: Icon, label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", warning: "text-warning", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={`font-mono text-xs font-semibold ${colors[color]}`}>{value}</span>
    </div>
  );
}

function GateItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-loss">{value}</span>
    </div>
  );
}