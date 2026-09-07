import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { scanAllLiveSniperSignals } from '../../shared/sniperLive.ts';

function killzone() {
  const h = new Date().getUTCHours();
  if (h >= 2 && h < 5) return 'LONDON';
  if (h >= 7 && h < 10) return 'NEW_YORK';
  if (h >= 10 && h < 12) return 'LONDON_CLOSE';
  if (h >= 20) return 'ASIA';
  return 'OFF';
}

function ictScore(s: any) {
  let score = 0;
  if (s.gate_htf_alignment) score += 15;
  if (s.gate_liquidity_sweep) score += 20;
  if (s.ict?.displacement) score += 15;
  if (s.ict?.mss_bos && s.ict.mss_bos !== 'NONE') score += 15;
  if (s.ict?.fvg_detected || s.ict?.order_block_detected) score += 15;
  const pdOk = s.side === 'LONG' ? s.ict?.premium_discount === 'DISCOUNT' : s.ict?.premium_discount === 'PREMIUM';
  if (pdOk) score += 10;
  if (['LONDON','NEW_YORK'].includes(killzone())) score += 10;
  return Math.min(100, score);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const started = Date.now();
    const source = await scanAllLiveSniperSignals();
    const signals = source.map((s: any) => ({
      id: `ict-${s.id}`,
      symbol: s.symbol,
      source: s.exchange,
      exchange: s.exchange,
      side: s.side || 'LONG',
      timeframe_entry: 'M1',
      timeframe_context: 'M15 / H4',
      htf_market_structure: s.htf_bias === 'LONG' ? 'LONG' : s.htf_bias === 'SHORT' ? 'SHORT' : 'NEUTRAL',
      liquidity_sweep: s.gate_liquidity_sweep === true,
      sweep_direction: s.side === 'LONG' ? 'DOWNWARD_SWEEP' : 'UPWARD_SWEEP',
      displacement: s.ict?.displacement === true,
      displacement_candles: s.ict?.displacement_candles || 0,
      mss_bos: s.ict?.mss_bos || 'NONE',
      mss_direction: s.ict?.mss_direction || 'NEUTRAL',
      fvg_detected: s.ict?.fvg_detected === true,
      fvg_top: s.ict?.fvg_top ?? null,
      fvg_bottom: s.ict?.fvg_bottom ?? null,
      order_block_detected: s.ict?.order_block_detected === true,
      ob_high: s.ict?.ob_high ?? null,
      ob_low: s.ict?.ob_low ?? null,
      premium_discount: s.ict?.premium_discount || 'EQUILIBRIUM',
      killzone: killzone(),
      gate_live_data: s.source_confirmed === true,
      gate_data_fresh: s.data_fresh === true,
      // These gates are intentionally NOT inferred from public market data.
      gate_news_clear: false,
      gate_risk_approved: false,
      gate_governance_approved: false,
      ict_score: ictScore(s),
      ascan_score: s.ascan_score || 0,
      crv: s.rr || 0,
      entry_price: s.entry_price ?? null,
      stop_loss: s.stop_loss ?? null,
      tp1: s.take_profit_1 ?? null,
      tp2: s.take_profit_2 ?? null,
      tp3: s.take_profit_3 ?? null,
      data_age_ms: s.data_age_ms ?? null,
      source_confirmed: s.source_confirmed === true,
      notes: s.source_confirmed
        ? 'Live Public REST. ICT-Struktur aus geschlossenen Candles abgeleitet. News/Risk/Governance nicht bestätigt → Hard Gate BLOCKED.'
        : `NO DATA / NO TRADE: ${s.error || 'market data unavailable'}`,
    }));
    return Response.json({
      status: signals.every((s: any) => s.source_confirmed) ? 'LIVE_BLOCKED' : 'DEGRADED_BLOCKED',
      source_type: 'LIVE_PUBLIC_REST', checked_at: new Date().toISOString(),
      scan_latency_ms: Date.now() - started, signals,
      live_execution: 'BLOCKED', order_send: 'BLOCKED',
      block_reason: 'NEWS_RISK_GOVERNANCE_NOT_CONFIRMED',
    });
  } catch (e: any) {
    return Response.json({ status: 'ERROR_BLOCKED', signals: [], error: e?.message || 'ICT_SCAN_FAILED', live_execution: 'BLOCKED', order_send: 'BLOCKED' }, { status: 500 });
  }
}
