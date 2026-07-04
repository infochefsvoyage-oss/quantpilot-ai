import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { KpiCard, SectionCard } from '@/components/terminal/Ui';
import { Play, Pause, FastForward, RotateCcw, History } from 'lucide-react';

export default function Backtest() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = () => {
    setRunning(true);
    setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(t); setRunning(false); return 100; }
        return p + 4;
      });
    }, 120);
  };

  return (
    <Layout>
      <StatusHeader title="Backtest & Replay" subtitle="ASCAN Engine über historische Candles simulieren" />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SectionCard title="Backtest-Konfiguration">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Symbol</label>
                <select className="mt-1 w-full bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono">
                  <option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Zeitraum</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input type="date" defaultValue="2026-01-01" className="bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono" />
                  <input type="date" defaultValue="2026-07-01" className="bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Timeframe</label>
                <select className="mt-1 w-full bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono">
                  <option>15m</option><option>1h</option><option>4h</option>
                </select>
              </div>
              <button onClick={run} disabled={running} className="w-full mt-2 px-4 py-2 rounded-md text-[12px] font-mono font-semibold bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 flex items-center justify-center gap-2">
                {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {running ? 'Läuft…' : 'Backtest starten'}
              </button>
            </div>
          </SectionCard>

          <div className="lg:col-span-2 space-y-5">
            <SectionCard title="Ergebnis-KPIs" right={<History className="w-4 h-4 text-slate-500" />}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Trades" value={142} tone="info" />
                <KpiCard label="Win Rate" value="61" unit="%" tone="positive" />
                <KpiCard label="Max Drawdown" value="3.8" unit="%" tone="warning" />
                <KpiCard label="Sharpe Ratio" value="1.74" tone="positive" />
              </div>
            </SectionCard>

            <SectionCard title="Equity-Kurve">
              <div className="h-40 flex items-end gap-1">
                {Array.from({ length: 48 }).map((_, i) => {
                  const h = 30 + Math.sin(i / 3) * 25 + i * 0.8;
                  return <div key={i} className="flex-1 bg-gradient-to-t from-cyan-500/40 to-cyan-400/80 rounded-t" style={{ height: `${Math.min(100, h)}%` }} />;
                })}
              </div>
              {progress > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>Replay-Fortschritt</span><span>{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Replay-Steuerung" right={
          <div className="flex gap-1.5">
            <button className="p-1.5 rounded-md border border-white/10 text-slate-300 hover:bg-white/5"><RotateCcw className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 rounded-md border border-white/10 text-slate-300 hover:bg-white/5"><Pause className="w-3.5 h-3.5" /></button>
            <button className="p-1.5 rounded-md border border-white/10 text-slate-300 hover:bg-white/5"><FastForward className="w-3.5 h-3.5" /></button>
          </div>
        }>
          <p className="text-[12px] text-slate-400">Bar-für-Bar Replay der historischen Candles mit ASCAN-Signal-Overlays. Pause/Play/Forward für detaillierte Setup-Analyse.</p>
        </SectionCard>
      </main>
    </Layout>
  );
}