import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { DecisionBadge, SectionCard } from '@/components/terminal/Ui';
import { RECENT_SIGNALS, AUDIT_LOGS } from '@/lib/terminalState';
import { Radio } from 'lucide-react';

export default function LiveFeed() {
  const [feed, setFeed] = useState([
    { id: 1, ts: '09:41:02', symbol: 'BTCUSDT', price: 61480, msg: 'Tick empfangen · Spread 0.012%', type: 'tick' },
    { id: 2, ts: '09:40:55', symbol: 'ETHUSDT', price: 3120, msg: 'Volume Spike detektiert', type: 'event' },
    { id: 3, ts: '09:40:30', symbol: 'SOLUSDT', price: 148.2, msg: 'Liquidity Sweep auf 5m', type: 'event' },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      const sym = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][Math.floor(Math.random() * 3)];
      const price = (Math.random() * 60000 + 100).toFixed(2);
      setFeed((f) => [{ id: Date.now(), ts: new Date().toLocaleTimeString('de-DE'), symbol: sym, price, msg: 'Tick empfangen', type: 'tick' }, ...f].slice(0, 40));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <Layout>
      <StatusHeader title="Live Feed" subtitle="Echtzeit-Markt-Events und Tick-Stream" />
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 overflow-y-auto">
        <div className="lg:col-span-2 space-y-5">
          <SectionCard title="Markt-Stream" right={<span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono"><Radio className="w-3 h-3 animate-pulse" /> LIVE</span>}>
            <div className="h-[420px] overflow-y-auto space-y-1 font-mono text-[11px]">
              {feed.map((f) => (
                <div key={f.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-white/5 border-b border-white/5">
                  <span className="text-slate-500">{f.ts}</span>
                  <span className="text-cyan-400 w-20">{f.symbol}</span>
                  <span className="text-slate-300 w-20 text-right">{f.price}</span>
                  <span className={f.type === 'event' ? 'text-amber-400' : 'text-slate-500'}>{f.msg}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Aktuelle ASCAN-Signale">
            <div className="space-y-2">
              {RECENT_SIGNALS.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-md border border-white/5 bg-white/[0.01]">
                  <div>
                    <div className="font-mono text-[12px] text-white">{s.symbol}</div>
                    <div className="text-[10px] text-slate-500">Score {s.ascan_score} · RR {s.rr}</div>
                  </div>
                  <DecisionBadge decision={s.decision} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Audit-Stream">
            <div className="space-y-1.5">
              {AUDIT_LOGS.map((l) => (
                <div key={l.id} className="flex items-start gap-2 text-[10px]">
                  <span className="text-slate-600 font-mono shrink-0">{l.timestamp.slice(11, 19)}</span>
                  <span className={`font-mono ${l.severity === 'WARNING' ? 'text-amber-400' : l.severity === 'CRITICAL' ? 'text-red-400' : 'text-slate-400'}`}>{l.event}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </main>
    </Layout>
  );
}