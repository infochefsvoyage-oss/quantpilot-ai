import React, { useEffect, useState } from 'react';
import PanelCard from '@/components/PanelCard';
import StatusBadge from '@/components/StatusBadge';
import { base44 } from '@/api/base44Client';

function Row({ label, status, value }) {
  const ok = String(status || '').startsWith('LIVE');
  return <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
    <div><div className="text-xs font-semibold text-foreground">{label}</div><div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{value || '—'}</div></div>
    <StatusBadge status={status || 'UNKNOWN'} color={ok ? 'profit' : status === 'NOT_CONFIGURED' ? 'warning' : 'loss'} />
  </div>;
}

export default function AscanContextPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await base44.functions.invoke('fetchAscanContext', { symbol: 'BTCUSDT' });
        if (mounted) { setData(r.data || r); setError(null); }
      } catch (e) { if (mounted) setError(e?.message || 'fetchAscanContext failed'); }
    };
    load(); const id = setInterval(load, 300000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const s = data?.sources || {};
  return <PanelCard title="ASCAN Context · 10/10 Data Layer" action={<span className="font-mono text-xs text-muted-foreground">READ ONLY · 5m Refresh · A+ Gate unverändert</span>}>
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
      <Row label="Derivatives" status={s.derivatives?.status} value={s.derivatives?.confirmed ? `Funding ${Number(s.derivatives.funding_rate_pct || 0).toFixed(4)}% · ${s.derivatives.crowding}` : 'Keine bestätigten Futures-Daten'} />
      <Row label="Macro" status={s.macro?.status} value={s.macro?.confirmed ? `Fed ${s.macro.fed_funds_effective_pct}% · US10Y ${s.macro.us10y_pct}%` : 'Keine bestätigten Makrodaten'} />
      <Row label="COT" status={s.cot?.status} value={s.cot?.confirmed ? `Lev Money Net ${Number(s.cot.leveraged_money_net || 0).toLocaleString('de-DE')}` : 'Keine bestätigten COT-Daten'} />
      <Row label="Macro / News" status={s.news?.status} value={s.news?.confirmed ? `${s.news.article_count || 0} Headlines · ${s.news.source}` : 'News-Feed nicht bestätigt'} />
      <Row label="Whale / On-Chain · Dune" status={s.whale?.status} value={s.whale?.confirmed ? `${s.whale.row_count || 0} Dune Rows` : 'DUNE_API_KEY + DUNE_WHALE_QUERY_ID erforderlich'} />
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs">
      <span className="text-muted-foreground">Context Sources: <span className="font-mono font-semibold text-foreground">{data ? `${data.confirmed_sources}/${data.total_sources}` : '…'}</span></span>
      <span className="font-mono text-warning">Execution Gate Effect: NONE · 4-Gate A+ bleibt Hard Gate</span>
    </div>
    {error && <div className="mt-2 rounded border border-loss/20 bg-loss/5 p-2 font-mono text-xs text-loss">CONTEXT ERROR · {error}</div>}
  </PanelCard>;
}
