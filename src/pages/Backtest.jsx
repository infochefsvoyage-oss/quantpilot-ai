import React, { useState } from "react";
import { FlaskConical, Play, Pause, SkipForward } from "lucide-react";
import { backtestResult } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function Backtest() {
  const [playing, setPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(backtestResult.equity_curve.length);
  const bt = backtestResult;
  const visibleCurve = bt.equity_curve.slice(0, currentBar);

  const minVal = Math.min(...bt.equity_curve);
  const maxVal = Math.max(...bt.equity_curve);
  const range = maxVal - minVal;

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Backtest & Replay
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">ASCAN Signal Engine über historische Daten – Replay-Modus mit Bar-für-Bar</p>
      </div>

      {/* Config Form */}
      <PanelCard title="Backtest Konfiguration">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Symbol" value={bt.symbol} />
          <FormField label="Timeframe" value={bt.timeframe} />
          <FormField label="Zeitraum" value={bt.period} />
          <div>
            <label className="text-xs text-muted-foreground">Aktion</label>
            <button className="mt-1 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground glow-cyan">
              Backtest starten
            </button>
          </div>
        </div>
      </PanelCard>

      {/* Results */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <BtStat label="Total Trades" value={bt.total_trades} />
        <BtStat label="Win Rate" value={`${bt.win_rate}%`} color={bt.win_rate >= 50 ? "profit" : "loss"} />
        <BtStat label="Total Return" value={`${bt.total_return}%`} color="profit" />
        <BtStat label="Max Drawdown" value={`${bt.max_drawdown}%`} color="warning" />
        <BtStat label="Sharpe Ratio" value={bt.sharpe_ratio.toFixed(2)} color={bt.sharpe_ratio >= 1.5 ? "profit" : "muted"} />
        <BtStat label="Profit Factor" value={bt.profit_factor.toFixed(2)} color="profit" />
        <BtStat label="Ø RR" value={bt.avg_rr.toFixed(1)} />
        <BtStat label="Gewinne / Verluste" value={`${bt.wins} / ${bt.losses}`} />
      </div>

      {/* Equity Curve */}
      <PanelCard
        title="Equity Curve"
        className="mt-4"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying(!playing)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/70"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => setCurrentBar((p) => Math.min(p + 1, bt.equity_curve.length))}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/70"
            >
              <SkipForward className="h-3.5 w-3.5" /> Next Bar
            </button>
          </div>
        }
      >
        <div className="relative h-64 w-full">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(191 100% 50%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(191 100% 50%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {visibleCurve.length > 1 && (
              <>
                <polygon
                  fill="url(#equityGrad)"
                  points={`0,100 ${visibleCurve.map((v, i) => `${(i / (visibleCurve.length - 1)) * 100},${100 - ((v - minVal) / range) * 100}`).join(" ")} 100,100`}
                />
                <polyline
                  fill="none"
                  stroke="hsl(191 100% 50%)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  points={visibleCurve.map((v, i) => `${(i / (visibleCurve.length - 1)) * 100},${100 - ((v - minVal) / range) * 100}`).join(" ")}
                />
              </>
            )}
          </svg>
          <div className="pointer-events-none absolute right-2 top-2 font-mono text-xs text-muted-foreground">
            Bar {currentBar} / {bt.equity_curve.length}
          </div>
        </div>
        <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
          <span>Start: {bt.equity_curve[0]}</span>
          <span>End: {visibleCurve[visibleCurve.length - 1] || "—"}</span>
        </div>
      </PanelCard>

      {/* Trade List */}
      <PanelCard title="Trade-Liste (Auszug)" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">#</th>
                <th className="pb-2 text-left font-medium">Symbol</th>
                <th className="pb-2 text-left font-medium">Seite</th>
                <th className="pb-2 text-center font-medium">Score</th>
                <th className="pb-2 text-right font-medium">Entry</th>
                <th className="pb-2 text-right font-medium">Exit</th>
                <th className="pb-2 text-center font-medium">RR</th>
                <th className="pb-2 text-center font-medium">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {[
                { n: 1, side: "LONG", score: 82, entry: 58200, exit: 60100, rr: 3.1, win: true },
                { n: 2, side: "SHORT", score: 76, entry: 61500, exit: 61800, rr: 2.8, win: false },
                { n: 3, side: "LONG", score: 88, entry: 59300, exit: 62100, rr: 3.5, win: true },
                { n: 4, side: "LONG", score: 79, entry: 60800, exit: 62500, rr: 2.9, win: true },
                { n: 5, side: "SHORT", score: 81, entry: 63200, exit: 61800, rr: 3.2, win: true },
              ].map((t) => (
                <tr key={t.n} className="border-b border-border/50">
                  <td className="py-2.5 font-mono text-muted-foreground">{t.n}</td>
                  <td className="py-2.5 font-mono font-semibold">{bt.symbol}</td>
                  <td className="py-2.5"><span className={t.side === "LONG" ? "text-profit" : "text-loss"}>{t.side}</span></td>
                  <td className="py-2.5 text-center font-mono">{t.score}</td>
                  <td className="py-2.5 text-right font-mono">{t.entry.toLocaleString("de-DE")}</td>
                  <td className="py-2.5 text-right font-mono">{t.exit.toLocaleString("de-DE")}</td>
                  <td className="py-2.5 text-center font-mono">{t.rr.toFixed(1)}</td>
                  <td className="py-2.5 text-center">
                    <StatusBadge status={t.win ? "WIN" : "LOSS"} color={t.win ? "profit" : "loss"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}

function FormField({ label, value }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 rounded-md border border-border bg-secondary/30 px-3 py-2 font-mono text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}

function BtStat({ label, value, color = "muted" }) {
  const colors = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", warning: "text-warning" };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-xl font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}