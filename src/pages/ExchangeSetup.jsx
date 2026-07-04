import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { SectionCard } from '@/components/terminal/Ui';
import { Lock, Key, ShieldCheck, Cable, Scan } from 'lucide-react';

const PHASES = [
  { id: 'PHASE_1', label: 'Phase 1 – Binance Testnet/Paper', desc: 'API-Key wird verschlüsselt gespeichert. Nur Paper-Trades.', locked: false },
  { id: 'PHASE_2', label: 'Phase 2 – Binance Shadow', desc: 'Shadow-Trading. Governance-Freigabe erforderlich.', locked: true },
  { id: 'PHASE_3', label: 'Phase 3 – Binance Live', desc: 'Live-Trading nur nach Governance-Freigabe.', locked: true },
  { id: 'PHASE_4', label: 'Phase 4 – MEXC Scan/Paper → Live', desc: 'MEXC zuerst als Scan-Modul, Live erst nach Freigabe.', locked: true },
];

export default function ExchangeSetup() {
  const [binanceKey, setBinanceKey] = useState('');
  const [binancePhase, setBinancePhase] = useState('PHASE_1');
  const [mexcScanOnly, setMexcScanOnly] = useState(true);

  return (
    <Layout>
      <StatusHeader title="Exchange Setup" subtitle="Binance- und MEXC-Adapter konfigurieren" />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-cyan-300 text-[12px]">
          <ShieldCheck className="w-4 h-4" /> API-Secrets werden niemals im Frontend gespeichert. Nur verschlüsselt (AES-256) in PostgreSQL.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Binance */}
          <SectionCard title="Binance Adapter" right={<span className="text-[10px] text-emerald-400 font-mono">AKTIV</span>}>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">API Key</label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 bg-[#0F1524]">
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <input value={binanceKey} onChange={(e) => setBinanceKey(e.target.value)} type="password" placeholder="Binance API Key" className="flex-1 bg-transparent text-[12px] text-slate-200 font-mono outline-none" />
                  </div>
                  <button className="px-3 py-2 rounded-md text-[12px] font-mono bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25">Speichern</button>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">Secret wird verschlüsselt gespeichert, nie im Frontend geladen.</p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">Phase</label>
                <div className="mt-2 space-y-2">
                  {PHASES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => !p.locked && setBinancePhase(p.id)}
                      disabled={p.locked}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${binancePhase === p.id ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 bg-white/[0.01]'} ${p.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-mono text-slate-200">{p.label}</span>
                        {p.locked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* MEXC */}
          <SectionCard title="MEXC Adapter" right={<span className="text-[10px] text-amber-400 font-mono">SCAN ONLY</span>}>
            <div className="space-y-4">
              <div className="p-4 rounded-md border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Scan className="w-4 h-4 text-amber-400" />
                  <span className="text-[12px] text-amber-300 font-semibold">Scan-Modus aktiv</span>
                </div>
                <p className="text-[11px] text-slate-400">MEXC läuft ausschließlich zum Scannen von Signalen. Paper-Trades möglich, Live-Trading deaktiviert.</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border border-white/5 bg-white/[0.01]">
                <span className="text-[12px] text-slate-300">MEXC Scan-Modus erzwingen</span>
                <button onClick={() => setMexcScanOnly(!mexcScanOnly)} className={`relative w-10 h-5 rounded-full transition-colors ${mexcScanOnly ? 'bg-amber-500' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${mexcScanOnly ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="p-3 rounded-md border border-red-500/20 bg-red-500/5 text-[11px] text-red-300 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Live-Trading auf MEXC erfordert separate Governance-Freigabe.
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Phasen-Übersicht">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {PHASES.map((p, i) => (
              <div key={p.id} className={`p-4 rounded-lg border ${i === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-white/[0.01]'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Cable className={`w-4 h-4 ${i === 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-[11px] font-mono text-slate-300">{p.id}</span>
                </div>
                <div className="text-[11px] text-slate-400">{p.desc}</div>
                <div className={`mt-2 text-[10px] font-mono ${i === 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{i === 0 ? 'aktiv' : 'gesperrt'}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </main>
    </Layout>
  );
}