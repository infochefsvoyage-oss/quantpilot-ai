import React from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { KpiCard, SectionCard } from '@/components/terminal/Ui';
import { OPEN_POSITIONS } from '@/lib/terminalState';
import { CheckCircle2, Circle } from 'lucide-react';

export default function Portfolio() {
  const totalExposure = OPEN_POSITIONS.reduce((a, p) => a + p.position_value, 0);
  const totalUpnl = OPEN_POSITIONS.reduce((a, p) => a + p.unrealized_pnl, 0);

  return (
    <Layout>
      <StatusHeader title="Portfolio" subtitle="Offene Positionen, Exposure und Money-Management-Status" />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Offene Positionen" value={OPEN_POSITIONS.length} tone="info" />
          <KpiCard label="Gesamt-Exposure" value={`$${totalExposure.toFixed(0)}`} tone="default" hint="Cap 10%" />
          <KpiCard label="Unrealisierter PnL" value={`${totalUpnl >= 0 ? '+' : ''}$${totalUpnl.toFixed(2)}`} tone={totalUpnl >= 0 ? 'positive' : 'negative'} />
          <KpiCard label="Exposure-Auslastung" value="7.4" unit="%" tone="warning" />
        </div>

        <SectionCard title="Offene Positionen">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono">
              <thead>
                <tr className="text-left text-slate-500 text-[10px] uppercase tracking-wider border-b border-white/5">
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Modus</th>
                  <th className="py-2 pr-3">Größe</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Aktuell</th>
                  <th className="py-2 pr-3">Stop</th>
                  <th className="py-2 pr-3">uPnL</th>
                  <th className="py-2 pr-3">TP-Status</th>
                </tr>
              </thead>
              <tbody>
                {OPEN_POSITIONS.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">{p.symbol}</td>
                    <td className="py-2 pr-3"><span className={p.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{p.side}</span></td>
                    <td className="py-2 pr-3"><span className="text-cyan-400">{p.mode}</span></td>
                    <td className="py-2 pr-3">{p.size}</td>
                    <td className="py-2 pr-3">{p.entry_price}</td>
                    <td className="py-2 pr-3 text-slate-200">{p.current_price}</td>
                    <td className="py-2 pr-3 text-amber-400">{p.stop_loss}</td>
                    <td className={`py-2 pr-3 ${p.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>+{p.unrealized_pnl}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1.5">
                        <span>{p.tp1_executed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-slate-600" />}</span>
                        <span>{p.tp2_executed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-slate-600" />}</span>
                        <span>{p.tp3_executed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-slate-600" />}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Money-Management-Plan (aktive Position)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { tp: 'TP1', pct: '40%', action: 'Schließen + Stop auf Break-even', status: 'offen' },
              { tp: 'TP2', pct: '30%', action: 'Schließen + Trailing Stop aktivieren', status: 'offen' },
              { tp: 'TP3', pct: '30%', action: 'Runner oder vollständiger Exit', status: 'offen' },
            ].map((t) => (
              <div key={t.tp} className="p-4 rounded-lg border border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-mono font-semibold text-cyan-400">{t.tp} · {t.pct}</span>
                  <span className="text-[10px] text-slate-500">{t.status}</span>
                </div>
                <p className="text-[11px] text-slate-400">{t.action}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-md border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-300">
            Nach zwei Verlusttrades am Tag: Risiko automatisch halbieren. Aktuelle Verlustserie: 1.
          </div>
        </SectionCard>
      </main>
    </Layout>
  );
}