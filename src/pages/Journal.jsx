import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { KpiCard, SectionCard } from '@/components/terminal/Ui';
import { JOURNAL_TODAY } from '@/lib/terminalState';
import { TrendingUp, TrendingDown, Target, ShieldCheck } from 'lucide-react';

export default function Journal() {
  const [notes, setNotes] = useState(JOURNAL_TODAY.notes);
  const j = JOURNAL_TODAY;

  return (
    <Layout>
      <StatusHeader title="Daily Performance Journal" subtitle={`Tagesbericht · ${j.date}`} />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Trades gesamt" value={j.trades_count} tone="info" />
          <KpiCard label="Win Rate" value={j.win_rate} unit="%" tone={j.win_rate >= 60 ? 'positive' : 'warning'} hint={`${j.wins}W / ${j.losses}L`} />
          <KpiCard label="Realisierter PnL" value={`${j.realized_pnl >= 0 ? '+' : ''}${j.realized_pnl}`} unit="%" tone={j.realized_pnl >= 0 ? 'positive' : 'negative'} />
          <KpiCard label="Max Drawdown" value={j.max_drawdown} unit="%" tone={j.max_drawdown >= 4 ? 'negative' : 'default'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Qualitätsmetriken">
            <div className="space-y-3">
              <MetricRow icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Gate-Erfolgsrate (A+)" value={`${j.gate_success_rate}%`} tone={j.gate_success_rate >= 70 ? 'text-emerald-400' : 'text-amber-400'} />
              <MetricRow icon={<ShieldCheck className="w-4 h-4 text-cyan-400" />} label="Money-Management-Einhaltung" value={`${j.mm_compliance}%`} tone="text-emerald-400" />
              <MetricRow icon={<TrendingDown className="w-4 h-4 text-amber-400" />} label="ULF Warnungen" value={j.ulf_warnings} tone={j.ulf_warnings > 2 ? 'text-amber-400' : 'text-slate-300'} />
              <MetricRow icon={<Target className="w-4 h-4 text-cyan-400" />} label="Tagesziel" value={j.daily_target_hit ? 'erreicht ✓' : 'offen'} tone={j.daily_target_hit ? 'text-emerald-400' : 'text-slate-300'} />
            </div>
          </SectionCard>

          <SectionCard title="Operator-Notizen">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} placeholder="Notizen zum Handelstag: Setup-Qualität, emotionale Disziplin, Verbesserungen..." className="w-full bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 resize-none" />
            <div className="flex justify-end mt-3">
              <button className="px-4 py-2 rounded-md text-[12px] font-mono font-semibold bg-cyan-500 text-black hover:bg-cyan-400">Notiz speichern</button>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Verlauf (letzte 7 Tage)">
          <div className="flex items-end gap-2 h-32">
            {[0.6, -0.4, 1.2, -0.8, 0.9, 1.5, j.realized_pnl].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t ${v >= 0 ? 'bg-emerald-400/70' : 'bg-red-400/70'}`}
                    style={{ height: `${Math.min(100, Math.abs(v) * 35)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-500 font-mono">T-{6 - i}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </main>
    </Layout>
  );
}

function MetricRow({ icon, label, value, tone }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border border-white/5 bg-white/[0.01]">
      <span className="flex items-center gap-2 text-[12px] text-slate-300">{icon}{label}</span>
      <span className={`text-[12px] font-mono font-semibold ${tone}`}>{value}</span>
    </div>
  );
}