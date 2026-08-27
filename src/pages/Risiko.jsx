import React, { useState } from 'react';
import Layout from '@/components/Layout';
import StatusHeader from '@/components/StatusHeader';
import { KpiCard, SectionCard } from '@/components/terminal/Ui';
import { ShieldCheck, AlertTriangle, Lock } from 'lucide-react';

const DEFAULTS = {
  risk_level: 'LEVEL_2',
  risk_per_trade: 0.5,
  max_open_positions: 1,
  portfolio_exposure_cap: 10,
  daily_loss_limit: 1.5,
  weekly_loss_limit: 4.0,
  max_drawdown_pause: 6.0,
  daily_target: 2.0,
  capital_priority: 'CAPITAL_PRESERVATION_FIRST',
  high_leverage_mode: 'DISABLED',
};

export default function Risiko() {
  const [settings, setSettings] = useState(DEFAULTS);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <Layout>
      <StatusHeader title="Risiko" subtitle="Risk-Defaults, Kapitalerhalt und Verlustgrenzen" />
      <main className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-[12px]">
          <ShieldCheck className="w-4 h-4" /> Kapitalerhalt hat Vorrang (CAPITAL_PRESERVATION_FIRST).
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Risiko / Trade" value={settings.risk_per_trade} unit="%" tone="default" />
          <KpiCard label="Max Positionen" value={settings.max_open_positions} tone="info" />
          <KpiCard label="Exposure Cap" value={settings.portfolio_exposure_cap} unit="%" tone="warning" />
          <KpiCard label="Tagesverlustlimit" value={settings.daily_loss_limit} unit="%" tone="negative" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Risk-Defaults">
            <div className="space-y-4">
              <Field label="Risiko-Level">
                <select value={settings.risk_level} onChange={(e) => set('risk_level', e.target.value)} className="bg-[#0F1524] border border-white/10 rounded-md px-3 py-2 text-[12px] text-slate-200 font-mono">
                  <option value="LEVEL_1">LEVEL_1 (konservativ)</option>
                  <option value="LEVEL_2">LEVEL_2 (Standard)</option>
                  <option value="LEVEL_3">LEVEL_3 (aggressiv)</option>
                </select>
              </Field>
              <Slider label="Risiko pro Trade (%)" value={settings.risk_per_trade} min={0.1} max={2} step={0.1} onChange={(v) => set('risk_per_trade', v)} />
              <Slider label="Max Open Positions" value={settings.max_open_positions} min={1} max={5} step={1} onChange={(v) => set('max_open_positions', v)} locked />
              <Slider label="Portfolio Exposure Cap (%)" value={settings.portfolio_exposure_cap} min={5} max={30} step={1} onChange={(v) => set('portfolio_exposure_cap', v)} />
              <Slider label="Daily Loss Limit (%)" value={settings.daily_loss_limit} min={0.5} max={5} step={0.1} onChange={(v) => set('daily_loss_limit', v)} />
              <Slider label="Weekly Loss Limit (%)" value={settings.weekly_loss_limit} min={1} max={10} step={0.5} onChange={(v) => set('weekly_loss_limit', v)} />
              <Slider label="Max Drawdown Pause (%)" value={settings.max_drawdown_pause} min={2} max={15} step={0.5} onChange={(v) => set('max_drawdown_pause', v)} />
            </div>
          </SectionCard>

          <div className="space-y-5">
            <SectionCard title="Levage & Kapitalerhalt">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-md border border-white/5 bg-white/[0.01]">
                  <span className="text-[12px] text-slate-300">High Leverage Mode</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-red-400"><Lock className="w-3.5 h-3.5" /> DISABLED</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border border-white/5 bg-white/[0.01]">
                  <span className="text-[12px] text-slate-300">Kapitalpriorität</span>
                  <span className="text-[11px] font-mono text-emerald-400">{settings.capital_priority}</span>
                </div>
                <Slider label="Tagesziel (%)" value={settings.daily_target} min={1} max={5} step={0.5} onChange={(v) => set('daily_target', v)} />
              </div>
            </SectionCard>

            <SectionCard title="Automatische Schutzregeln">
              <ul className="space-y-2 text-[11px] text-slate-400">
                <li className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> Nach {2} Verlusttrades: Risiko halbieren (0.5% → 0.25%).</li>
                <li className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> Bei Tagesverlustlimit ({settings.daily_loss_limit}%): Trading pausieren.</li>
                <li className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> Bei Max Drawdown ({settings.max_drawdown_pause}%): Pause bis Reset.</li>
                <li className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> Bei Tagesziel erreicht: Risiko reduzieren oder Trading beenden.</li>
                <li className="flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> Kein Forced Trading – nur A+ Setups.</li>
              </ul>
            </SectionCard>
          </div>
        </div>
      </main>
    </Layout>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-slate-300">{label}</span>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, locked = false }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-slate-300">{label}</span>
        <span className="text-[11px] font-mono text-cyan-400">{value}{locked ? ' (gesperrt)' : ''}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        disabled={locked}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}