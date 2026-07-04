import React, { useState } from 'react';
import { Shield, AlertTriangle, Bell, X } from 'lucide-react';
import { PENDING_GOVERNANCE, RUNTIME_STATUS } from '@/lib/terminalState';

export default function StatusHeader({ title, subtitle }) {
  const [stopOpen, setStopOpen] = useState(false);
  const pendingCount = PENDING_GOVERNANCE.length;
  const mode = RUNTIME_STATUS.mode;
  const modeColor =
    mode === 'LIVE' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : mode === 'SHADOW' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    : 'text-slate-300 bg-slate-500/10 border-slate-500/30';

  return (
    <header className="h-16 shrink-0 border-b border-white/5 bg-[#0A0E1A]/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-[15px] font-semibold text-white tracking-wide">{title}</h1>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Runtime status */}
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-md border border-white/5 bg-white/5">
          <span className={`w-1.5 h-1.5 rounded-full ${RUNTIME_STATUS.runtime === 'RUNNING' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-slate-400">RUNTIME</span>
          <span className="text-slate-200">{RUNTIME_STATUS.runtime}</span>
        </div>

        {/* Mode */}
        <div className={`text-[11px] font-mono px-3 py-1.5 rounded-md border ${modeColor}`}>
          {mode} · {RUNTIME_STATUS.exchange.toUpperCase()}
        </div>

        {/* Governance pending */}
        <div className="relative flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <Bell className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{pendingCount} offen</span>
          {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-[8px] text-black font-bold flex items-center justify-center">{pendingCount}</span>}
        </div>

        {/* Emergency Stop */}
        <button
          onClick={() => setStopOpen(true)}
          className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          EMERGENCY STOP
        </button>
      </div>

      {stopOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setStopOpen(false)}>
          <div className="max-w-md w-full bg-[#0F1524] border border-red-500/30 rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Emergency Stop aktivieren?</h3>
                <p className="text-[12px] text-slate-400 mt-1">Blockiert sofort alle neuen Trades. Offene Positionen werden markiert. Entsperrung nur über Governance-Freigabe.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStopOpen(false)} className="px-4 py-2 text-[12px] rounded-md border border-white/10 text-slate-300 hover:bg-white/5">Abbrechen</button>
              <button onClick={() => setStopOpen(false)} className="px-4 py-2 text-[12px] rounded-md bg-red-500 text-white font-semibold hover:bg-red-600 flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" /> Trading stoppen
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}