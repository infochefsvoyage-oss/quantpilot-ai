import React from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { DecisionBadge, GateStatus, KpiCard, SectionCard } from '@/components/terminal/Ui';
import { RUNTIME_STATUS, DASHBOARD_KPI, RECENT_SIGNALS, OPEN_POSITIONS, ULF_WARNINGS, PENDING_GOVERNANCE } from '@/lib/terminalState';
import { AlertTriangle, ShieldCheck, Zap, TrendingUp, TrendingDown, Bell } from 'lucide-react';

export default function Dashboard() {
  const pnlTone = DASHBOARD_KPI.daily_pnl >= 0 ? 'positive' : 'negative';
  const ddTone = DASHBOARD_KPI.max_drawdown >= 4 ? 'negative' : DASHBOARD_KPI.max_drawdown >= 2.5 ? 'warning' : 'default';

  return (
    <Layout>
      <StatusHeader title="Dashboard" subtitle="Echtzeit-Übersicht über Modus, Risiko, Positionen und Signale" />

      {RUNTIME_STATUS.emergency_stop && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-[12px]">
          <AlertTriangle className="w-4 h-4" /> EMERGENCY STOP AKTIV – alle neuen Trades blockiert.
        </div>
      )}

      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Modus" value={RUNTIME_STATUS.mode} tone="info" hint={`Phase ${RUNTIME_STATUS.phase}`} />
          <KpiCard label="Risiko / Trade" value={DASHBOARD_KPI.risk_per_trade} unit="%" tone="default" />
          <KpiCard label="Offene Positionen" value={DASHBOARD_KPI.open_positions} tone={DASHBOARD_KPI.open_positions > 0 ? 'info' : 'default'} />
          <KpiCard label="Tages-PnL" value={`${DASHBOARD_KPI.daily_pnl >= 0 ? '+' : ''}${DASHBOARD_KPI.daily_pnl}`} unit="%" tone={pnlTone} hint={`Ziel ${DASHBOARD_KPI.daily_target}%`} />
          <KpiCard label="Max Drawdown" value={DASHBOARD_KPI.max_drawdown} unit="%" tone={ddTone} hint={`Pause ab 6%`} />
          <KpiCard label="Exposure" value={DASHBOARD_KPI.portfolio_exposure} unit="%" tone={DASHBOARD_KPI.portfolio_exposure > 8 ? 'warning' : 'default'} hint="Cap 10%" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left col: Signals + Positions */}
          <div className="lg:col-span-2 space-y-5">
            <SectionCard title="Letzte ASCAN-Signale" right={<span className="text-[10px] text-slate-500 font-mono">{RECENT_SIGNALS.length} ausgewertet</span>}>
              <div className="space-y-2">
                {RECENT_SIGNALS.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-1 h-9 rounded-full ${s.side === 'LONG' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-white font-semibold">{s.symbol}</span>
                          <span className="text-[10px] text-slate-500">{s.exchange.toUpperCase()}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${s.side === 'LONG' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>{s.side}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Score {s.ascan_score} · RR {s.rr} · {s.timeframe}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex gap-1">
                        {Object.values(s.gates).map((g, i) => (
                          <span key={i} className={`w-2 h-2 rounded-full ${g ? 'bg-emerald-400' : 'bg-red-400/60'}`} />
                        ))}
                      </div>
                      <DecisionBadge decision={s.decision} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Offene Positionen" right={<span className="text-[10px] text-slate-500 font-mono">{OPEN_POSITIONS.length} aktiv</span>}>
              {OPEN_POSITIONS.length === 0 ? (
                <p className="text-[12px] text-slate-500 text-center py-6">Keine offenen Positionen.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] font-mono">
                    <thead>
                      <tr className="text-left text-slate-500 text-[10px] uppercase tracking-wider border-b border-white/5">
                        <th className="py-2 pr-3">Symbol</th>
                        <th className="py-2 pr-3">Side</th>
                        <th className="py-2 pr-3">Entry</th>
                        <th className="py-2 pr-3">Aktuell</th>
                        <th className="py-2 pr-3">Stop</th>
                        <th className="py-2 pr-3 text-right">uPnL</th>
                        <th className="py-2 pr-3 text-right">RR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OPEN_POSITIONS.map((p) => (
                        <tr key={p.id} className="border-b border-white/5">
                          <td className="py-2 pr-3 text-white">{p.symbol}</td>
                          <td className="py-2 pr-3"><span className={p.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{p.side}</span></td>
                          <td className="py-2 pr-3">{p.entry_price}</td>
                          <td className="py-2 pr-3">{p.current_price}</td>
                          <td className="py-2 pr-3 text-amber-400">{p.stop_loss}</td>
                          <td className={`py-2 pr-3 text-right ${p.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>+{p.unrealized_pnl}</td>
                          <td className="py-2 pr-3 text-right text-cyan-400">{p.rr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right col: Gate Status, Governance, ULF */}
          <div className="space-y-5">
            <SectionCard title="A+ Gate Status (Top-Signal)">
              {RECENT_SIGNALS[0] ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white text-[13px]">{RECENT_SIGNALS[0].symbol}</span>
                    <DecisionBadge decision={RECENT_SIGNALS[0].decision} />
                  </div>
                  <GateStatus gates={RECENT_SIGNALS[0].gates} />
                </div>
              ) : <p className="text-[12px] text-slate-500">Kein aktives Signal.</p>}
            </SectionCard>

            <SectionCard title="Governance – Offene Freigaben" right={<span className="flex items-center gap-1 text-[10px] text-amber-400"><Bell className="w-3 h-3" />{PENDING_GOVERNANCE.length}</span>}>
              {PENDING_GOVERNANCE.length === 0 ? (
                <div className="flex items-center gap-2 text-[12px] text-slate-500"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Keine offenen Freigaben.</div>
              ) : (
                <div className="space-y-2">
                  {PENDING_GOVERNANCE.map((g) => (
                    <div key={g.id} className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-amber-300 font-semibold">{g.action_type}</span>
                        <span className="text-[10px] text-slate-500">{g.prepared_at.slice(0, 10)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{g.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="ULF Warnungen">
              <div className="space-y-2">
                {ULF_WARNINGS.map((w) => (
                  <div key={w.id} className="flex items-start gap-2 text-[11px]">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${w.level === 'CRITICAL' ? 'bg-red-400' : w.level === 'WARNING' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                    <span className={w.level === 'CRITICAL' ? 'text-red-300' : w.level === 'WARNING' ? 'text-amber-300' : 'text-slate-400'}>{w.message}</span>
                    <span className="text-slate-600 ml-auto font-mono">{w.ts}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Daily target bar */}
        <SectionCard title="Tagesfortschritt" right={
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            {DASHBOARD_KPI.daily_pnl >= DASHBOARD_KPI.daily_target ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <Zap className="w-3.5 h-3.5 text-cyan-400" />}
            {DASHBOARD_KPI.daily_pnl >= DASHBOARD_KPI.daily_target ? 'Ziel erreicht – Risiko reduzieren' : 'Auf Kurs'}
          </span>
        }>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${DASHBOARD_KPI.daily_pnl >= DASHBOARD_KPI.daily_target ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
                style={{ width: `${Math.min(100, (DASHBOARD_KPI.daily_pnl / DASHBOARD_KPI.daily_target) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-300">{DASHBOARD_KPI.daily_pnl}% / {DASHBOARD_KPI.daily_target}%</span>
          </div>
        </SectionCard>
      </main>
    </Layout>
  );
}