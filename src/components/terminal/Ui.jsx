import React from 'react';
import { Check, X } from 'lucide-react';
import { DECISION_META } from '@/lib/terminalState';

export function DecisionBadge({ decision }) {
  const m = DECISION_META[decision] || DECISION_META.NO_TRADE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold ${m.bg} ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function GateStatus({ gates }) {
  const items = [
    { key: 'liquidity_sweep', label: 'Liquidity Sweep' },
    { key: 'reclaim_rejection', label: 'Reclaim/Rejection' },
    { key: 'volume_confirmation', label: 'Volume Confirmation' },
    { key: 'htf_alignment', label: 'HTF Alignment' },
  ];
  const passed = items.filter((i) => gates?.[i.key]).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">A+ Gate Status</span>
        <span className={`text-[11px] font-mono ${passed === 4 ? 'text-emerald-400' : passed >= 2 ? 'text-amber-400' : 'text-red-400'}`}>
          {passed}/4
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((it) => {
          const ok = gates?.[it.key];
          return (
            <div key={it.key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[10px] ${ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-red-500/20 bg-red-500/5 text-red-300/80'}`}>
              {ok ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
              <span className="truncate">{it.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KpiCard({ label, value, unit, tone = 'default', hint }) {
  const tones = {
    default: 'text-slate-100',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-cyan-400',
  };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{label}</div>
      <div className={`text-2xl font-mono font-semibold ${tones[tone]}`}>
        {value}<span className="text-sm text-slate-500 ml-1">{unit}</span>
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function SectionCard({ title, right, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-white/5 bg-white/[0.02] ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-[12px] font-semibold text-slate-200 uppercase tracking-wider">{title}</h3>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}