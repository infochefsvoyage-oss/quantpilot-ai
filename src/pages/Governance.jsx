import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { SectionCard } from '@/components/terminal/Ui';
import { PENDING_GOVERNANCE, AUDIT_LOGS } from '@/lib/terminalState';
import { Lock, ShieldCheck, X, Clock, Check } from 'lucide-react';

const ACTION_TYPES = [
  'LIVE_TRADE', 'PAPER_TO_LIVE', 'RISK_INCREASE', 'LEVERAGE_INCREASE',
  'EXCHANGE_KEY_ACTIVATION', 'DISABLE_STOP_LOSS', 'MAX_POSITIONS_INCREASE',
  'STRATEGY_SWITCH', 'EMERGENCY_OVERRIDE',
];

export default function Governance() {
  const [pending, setPending] = useState(PENDING_GOVERNANCE);
  const [reason, setReason] = useState('');
  const [type, setType] = useState(ACTION_TYPES[0]);
  const [log, setLog] = useState([]);

  const decide = (id, decision) => {
    setPending((p) => p.filter((x) => x.id !== id));
    setLog((l) => [{ id: `dec-${Date.now()}`, action: pending.find((x) => x.id === id)?.action_type, decision, ts: new Date().toLocaleTimeString() }, ...l]);
  };

  const prepare = () => {
    if (!reason.trim()) return;
    setPending((p) => [{ id: `gov-${Date.now()}`, action_type: type, reason, prepared_at: new Date().toISOString(), requested_by: 'operator' }, ...p]);
    setReason('');
  };

  return (
    <Layout>
      <StatusHeader title="Governance" subtitle="Zweistufige Freigabe für kritische Trading-Aktionen" />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-[12px]">
          <Lock className="w-4 h-4" /> Live-Trading ist standardmäßig deaktiviert. Jede Änderung erfordert Prepare → Approve.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Prepare */}
          <SectionCard title="Aktion vorbereiten (Prepare)">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Aktionstyp</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono">
                  {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Begründung</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Warum wird diese Aktion benötigt?" className="mt-1 w-full bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200" />
              </div>
              <button onClick={prepare} disabled={!reason.trim()} className="px-4 py-2 rounded-md text-[12px] font-mono font-semibold bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Freigabe anfordern
              </button>
            </div>
          </SectionCard>

          {/* Pending */}
          <SectionCard title="Offene Freigaben" right={<span className="text-[10px] text-amber-400 font-mono">{pending.length} offen</span>}>
            {pending.length === 0 ? (
              <div className="flex items-center gap-2 text-[12px] text-slate-500 py-6"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Keine offenen Freigaben.</div>
            ) : (
              <div className="space-y-3">
                {pending.map((g) => (
                  <div key={g.id} className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-mono font-semibold text-amber-300">{g.action_type}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{g.prepared_at.slice(0, 10)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">{g.reason}</p>
                    <div className="flex gap-2">
                      <button onClick={() => decide(g.id, 'approved')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => decide(g.id, 'rejected')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Governance-Entscheidungen (Verlauf)">
          {log.length === 0 ? (
            <p className="text-[12px] text-slate-500 py-4 text-center">Noch keine Entscheidungen in dieser Sitzung.</p>
          ) : (
            <div className="space-y-2">
              {log.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[12px] font-mono p-2 rounded-md border border-white/5 bg-white/[0.01]">
                  <span className="text-slate-300">{l.action}</span>
                  <span className={l.decision === 'approved' ? 'text-emerald-400' : 'text-red-400'}>{l.decision.toUpperCase()}</span>
                  <span className="text-slate-500">{l.ts}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </main>
    </Layout>
  );
}