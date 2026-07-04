import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { SectionCard } from '@/components/terminal/Ui';
import { Bell, MessageSquare, Save, Info } from 'lucide-react';

export default function Einstellungen() {
  const [telegram, setTelegram] = useState('');
  const [desktop, setDesktop] = useState(true);
  const [reconcile, setReconcile] = useState(true);
  const [circuitBreaker, setCircuitBreaker] = useState(3);
  const [rateBackoff, setRateBackoff] = useState(true);

  return (
    <Layout>
      <StatusHeader title="Einstellungen" subtitle="Benachrichtigungen, Sicherheit und System-Parameter" />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Benachrichtigungen">
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-[12px] text-slate-300 mb-1.5"><MessageSquare className="w-3.5 h-3.5 text-cyan-400" /> Telegram Bot Token</label>
                <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="password" placeholder="123456:ABC-DEF..." className="w-full bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono" />
              </div>
              <Toggle label="Desktop-Benachrichtigungen" desc="Browser-Notifications für Signale & Emergency Stop" on={desktop} set={setDesktop} icon={<Bell className="w-4 h-4 text-amber-400" />} />
            </div>
          </SectionCard>

          <SectionCard title="Sicherheit & System">
            <div className="space-y-3">
              <Toggle label="Order-Reconciliation" desc="Automatischer Abgleich nach Trade-Timeout" on={reconcile} set={setReconcile} />
              <Toggle label="Rate-Limit Backoff" desc="Exponentielles Backoff pro Exchange" on={rateBackoff} set={setRateBackoff} />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-slate-300">Circuit Breaker Schwelle</span>
                  <span className="text-[11px] font-mono text-cyan-400">{circuitBreaker} Fehler → 60s Pause</span>
                </div>
                <input type="range" min={1} max={10} step={1} value={circuitBreaker} onChange={(e) => setCircuitBreaker(parseInt(e.target.value))} className="w-full accent-cyan-400" />
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Über QuantPilot AI">
          <div className="flex items-start gap-3 p-3 rounded-md border border-white/5 bg-white/[0.01]">
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div className="text-[11px] text-slate-400 space-y-1">
              <p><span className="text-slate-200 font-semibold">OP-777 Sniper Desk</span> · v1.0.0 · KI-gestützter Trading-Desk für Binance & MEXC.</p>
              <p>Diese App garantiert keinen täglichen Gewinn. „Daily Profit" ist eine Ziel-KPI, kein Versprechen. Kapitalerhalt hat Vorrang.</p>
              <p>Live-Trading ist standardmäßig deaktiviert und erfordert Governance-Freigabe.</p>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-md text-[12px] font-mono font-semibold bg-cyan-500 text-black hover:bg-cyan-400 flex items-center gap-2">
            <Save className="w-3.5 h-3.5" /> Einstellungen speichern
          </button>
        </div>
      </main>
    </Layout>
  );
}

function Toggle({ label, desc, on, set, icon }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border border-white/5 bg-white/[0.01]">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <div className="text-[12px] text-slate-300">{label}</div>
          <div className="text-[10px] text-slate-500">{desc}</div>
        </div>
      </div>
      <button onClick={() => set(!on)} className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-cyan-500' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}