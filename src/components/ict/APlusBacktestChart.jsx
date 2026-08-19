// A+ Setup Historie — 20.000 Kerzen Backtest Chart
// Zeigt Anzahl und Trefferquote der A+ Setups über die letzten 20.000 M1 Candles.
// Fetcht Candles via Backend-Funktion, führt ICT-Backtest im Browser aus,
// stellt Ergebnisse grafisch dar (Bar Chart pro Tag + Donut Verteilung).
//
// Read-Only / Shadow — keine Live-Execution.

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { base44 } from "@/api/base44Client";
import { runAPlusBacktest } from "@/lib/ictBacktest";
import PanelCard from "@/components/PanelCard";
import {
  Crosshair,
  Target,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  Lock,
} from "lucide-react";

const WIN_COLOR = "hsl(153 84% 45%)";
const LOSS_COLOR = "hsl(0 84% 60%)";
const TIMEOUT_COLOR = "hsl(215 16% 55%)";

export default function APlusBacktestChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runBacktest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("fetchCandleHistoryBatch", {});
      const res = response.data || response;
      if (res.error) throw new Error(res.error);

      const candles = res.candles.map((c) => ({
        time: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
      }));

      // Yield to let loading spinner render before heavy computation
      await new Promise((r) => setTimeout(r, 50));

      const result = runAPlusBacktest(candles);
      setData(result);
    } catch (e) {
      setError(e.message || "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runBacktest();
  }, [runBacktest]);

  if (loading && !data) {
    return (
      <PanelCard title="A+ Setup Historie — 20.000 Kerzen Backtest">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">
              Backtest wird über 20.000 Kerzen ausgeführt…
            </p>
          </div>
        </div>
      </PanelCard>
    );
  }

  if (error && !data) {
    return (
      <PanelCard title="A+ Setup Historie — 20.000 Kerzen Backtest">
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <p className="text-sm text-loss">Fehler: {error}</p>
          <button
            onClick={runBacktest}
            className="rounded-md bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20"
          >
            Erneut versuchen
          </button>
        </div>
      </PanelCard>
    );
  }

  if (!data) return null;

  const pieData = [
    { name: "Wins (TP1)", value: data.wins, color: WIN_COLOR },
    { name: "Losses (SL)", value: data.losses, color: LOSS_COLOR },
    { name: "Timeouts", value: data.timeouts, color: TIMEOUT_COLOR },
  ].filter((d) => d.value > 0);

  const hitRateColor =
    data.hit_rate >= 60 ? WIN_COLOR : data.hit_rate >= 40 ? "hsl(38 92% 54%)" : LOSS_COLOR;

  return (
    <PanelCard
      title="A+ Setup Historie — 20.000 Kerzen Backtest"
      action={
        <button
          onClick={runBacktest}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Neu berechnen
        </button>
      }
    >
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <BacktestKpi
          icon={Crosshair}
          label="A+ Setups"
          value={data.total_setups}
          sub={`${data.candle_count.toLocaleString("de-DE")} Kerzen gescannt`}
          color="primary"
        />
        <BacktestKpi
          icon={Target}
          label="Trefferquote"
          value={`${data.hit_rate}%`}
          sub={`${data.wins}/${data.decided} entschieden`}
          color={data.hit_rate >= 50 ? "profit" : "loss"}
        />
        <BacktestKpi icon={TrendingUp} label="Wins (TP1)" value={data.wins} color="profit" />
        <BacktestKpi icon={TrendingDown} label="Losses (SL)" value={data.losses} color="loss" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Daily Bar Chart */}
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">
            A+ Setups pro Tag (Wins / Losses / Timeouts)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.daily_data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(215 16% 55%)" }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215 16% 55%)" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 44% 10%)",
                  border: "1px solid hsl(222 30% 18%)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                cursor={{ fill: "hsl(222 30% 18% / 0.3)" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="wins" name="Wins" stackId="a" fill={WIN_COLOR} />
              <Bar dataKey="losses" name="Losses" stackId="a" fill={LOSS_COLOR} />
              <Bar dataKey="timeouts" name="Timeouts" stackId="a" fill={TIMEOUT_COLOR} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut Chart */}
        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Verteilung</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 44% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
              Keine Setups gefunden
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border pt-3">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {data.candle_count.toLocaleString("de-DE")} M1 Kerzen
        </span>
        <span>·</span>
        <span>
          {data.oldest_candle
            ? new Date(data.oldest_candle * 1000).toLocaleDateString("de-DE")
            : "—"}{" "}
          –{" "}
          {data.newest_candle
            ? new Date(data.newest_candle * 1000).toLocaleDateString("de-DE")
            : "—"}
        </span>
        <span>·</span>
        <span className="flex items-center gap-1 text-warning">
          <Lock className="h-3 w-3" />
          Shadow-Backtest · Live-Execution BLOCKED
        </span>
      </div>
    </PanelCard>
  );
}

function BacktestKpi({ icon: Icon, label, value, sub, color }) {
  const colors = {
    primary: "text-primary bg-primary/10",
    profit: "text-profit bg-profit/10",
    loss: "text-loss bg-loss/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${colors[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={`mt-2 font-mono text-xl font-bold ${colors[color].split(" ")[0]}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 font-mono text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}