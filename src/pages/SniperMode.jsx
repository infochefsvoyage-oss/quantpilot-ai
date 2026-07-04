import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { DecisionBadge, GateStatus, SectionCard } from '@/components/terminal/Ui';
import { RECENT_SIGNALS } from '@/lib/terminalState';
import { Crosshair, Zap, Eye, Ban } from 'lucide-react';

export default function SniperMode() {
  const [selected, setSelected] = useState(RECENT_SIGNALS[0]);
  const eligible = selected && selected.ascan_score >= 75 && selected.rr >= 2.5;

  return (
    <Layout>
      <StatusHeader title="Sniper Mode" subtitle="A+ Setups nach allen 4 ASCAN-Pflichtgattern" />
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 overflow-y-auto">
        {/* Signal list */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1">Signal-Queue</div>
          {RECENT_SIGNALS.map((s) => {
            const active = selected?.id === s.id;
            const icon =
              s.decision === 'ENTER' ? <Zap className="w-3.5 h-3.5 text-emerald-400" />
              : s.decision === 'WATCH_ONLY' ? <Eye className="w-3.5 h-3.5 text-amber-400" />
              : s.decision === 'NO_TRADE' ? <Ban className="w-3.5 h-3.5 text-red-400" />
              : <Crosshair className="w-3.5 h-3.5 text-cyan-400" />;
            return (
              <button key={s.id} onClick={() => setSelected(s)} className={`w-full text-left p-3 rounded-lg border transition-colors ${active ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-mono text-[13px] text-white">{s.symbol}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.side}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">S{s.ascan_score}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-slate-500 font-mono">RR {s.rr} · {s.timeframe}</span>
                  <DecisionBadge decision={s.decision} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-5">
          {selected && (
            <>
              <SectionCard title="Signal-Detail" right={<DecisionBadge decision={selected.decision} />}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div><div className="text-[10px] text-slate-500 uppercase">Symbol</div><div className="font-mono text-white text-[13px]">{selected.symbol}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">Exchange</div><div className="font-mono text-slate-200 text-[13px]">{selected.exchange.toUpperCase()}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">ASCAN Score</div><div className={`font-mono text-[13px] ${selected.ascan_score >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>{selected.ascan_score}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">RR</div><div className={`font-mono text-[13px] ${selected.rr >= 2.5 ? 'text-emerald-400' : 'text-red-400'}`}>{selected.rr}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">Entry</div><div className="font-mono text-slate-200 text-[13px]">{selected.entry_price}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">Stop Loss</div><div className="font-mono text-amber-400 text-[13px]">{selected.stop_loss}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">Take Profit</div><div className="font-mono text-emerald-400 text-[13px]">{selected.take_profit}</div></div>
                  <div><div className="text-[10px] text-slate-500 uppercase">Spread</div><div className="font-mono text-slate-200 text-[13px]">{selected.spread}%</div></div>
                </div>
                <GateStatus gates={selected.gates} />
              </SectionCard>

              <SectionCard title="Trade-Ausführung (Paper)">
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-white/[0.01]">
                  <div>
                    <div className="text-[12px] text-slate-300">Berechtigung</div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {eligible ? 'Alle Mindestwerte erfüllt – Paper-Order möglich.' : 'Mindestwerte (Score ≥ 75, RR ≥ 2.5) nicht erfüllt – nur WATCH_ONLY.'}
                    </p>
                  </div>
                  <button
                    disabled={!eligible}
                    className={`px-4 py-2 rounded-md text-[12px] font-mono font-semibold flex items-center gap-2 ${eligible ? 'bg-cyan-500 text-black hover:bg-cyan-400' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                  >
                    <Zap className="w-3.5 h-3.5" /> Paper Order
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-3">Live-Trading ist standardmäßig deaktiviert. Shadow-/Live-Order nur nach Governance-Freigabe.</p>
              </SectionCard>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}