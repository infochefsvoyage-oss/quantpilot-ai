import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { scanAllLiveSniperSignals } from '../../shared/sniperLive.ts';
import { evaluateRiskGate } from '../../shared/riskGate.ts';

const PAPER_TEST_EQUITY = 10000;

function markPnl(trade:any, price:number) {
  const size = Number(trade.size || 0);
  const entry = Number(trade.entry_price || 0);
  if (!size || !entry || !price) return 0;
  const raw = trade.side === 'SHORT' ? (entry - price) * size : (price - entry) * size;
  return Math.round(raw * 100) / 100;
}

function provenance(s:any) {
  return {
    requested_exchange: s?.requested_exchange || s?.exchange || null,
    actual_source_exchange: s?.actual_source_exchange || s?.exchange || null,
    source_mode: s?.source_mode || 'NATIVE',
    source_type: s?.source_type || 'LIVE_PUBLIC_REST',
    endpoint: s?.endpoint || null,
    source_endpoints: s?.source_endpoints || null,
    fallback_reason: s?.fallback_reason || null,
    source_timestamp_ms: s?.source_timestamp_ms || null,
    data_age_ms: s?.data_age_ms ?? null,
    freshness_threshold_ms: s?.freshness_threshold_ms ?? null,
    market_observed_at: s?.market_observed_at || null,
  };
}

function allFourGates(s:any) {
  return [s?.gate_liquidity_sweep, s?.gate_reclaim_rejection, s?.gate_volume_confirmation, s?.gate_htf_alignment].every(Boolean);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });

    const started = Date.now();
    const signals:any[] = await scanAllLiveSniperSignals();
    const confirmed = signals.filter(s => s.source_confirmed && s.data_fresh);
    const eligible = signals.filter(s => s.decision === 'ENTER' && allFourGates(s) && s.source_confirmed && s.data_fresh && s.spread_ok && s.stop_loss_present && s.ascan_score >= 75 && s.rr >= 2.5);

    await base44.entities.AuditLog.create({
      event:'E2E_PAPER_SCAN_COMPLETE', category:'TRADING', severity:'INFO', actor:'sniper_e2e',
      details:`Live scan complete: ${confirmed.length}/${signals.length} sources confirmed; ${eligible.length} A+ ENTER`,
      metadata:{ source:'LIVE_PUBLIC_REST', scanned:signals.length, confirmed:confirmed.length, eligible:eligible.length, provenance:signals.map(s => ({ symbol:s.symbol, exchange:s.exchange, ...provenance(s) })), order_send:'BLOCKED', live_execution:'BLOCKED' }
    });

    // Position → PnL reconciliation for any existing Sniper paper positions.
    const trades = await base44.entities.Trade.list('-created_date', 200);
    const openPaper = trades.filter((t:any) => t.mode === 'PAPER' && t.status === 'open' && String(t.signal_id || '').startsWith('SNIPER:'));
    const reconciled:any[] = [];
    for (const t of openPaper) {
      const s = signals.find(x => x.symbol === t.symbol && String(x.exchange).toLowerCase() === String(t.exchange).toLowerCase());
      if (!s?.source_confirmed || !s?.data_fresh || !s.current_market_price) continue;
      const current = Number(s.current_market_price);
      const pnl = markPnl(t, current);
      let status = 'open';
      let closeReason:any = undefined;
      let realized = Number(t.realized_pnl || 0);
      const sl = Number(t.stop_loss || 0);
      const tp = Number(t.take_profit || 0);
      if (t.side === 'LONG' && sl && current <= sl) { status='closed'; closeReason='SL_HIT'; realized=pnl; }
      if (t.side === 'SHORT' && sl && current >= sl) { status='closed'; closeReason='SL_HIT'; realized=pnl; }
      if (t.side === 'LONG' && tp && current >= tp) { status='closed'; closeReason='TP1_HIT'; realized=pnl; }
      if (t.side === 'SHORT' && tp && current <= tp) { status='closed'; closeReason='TP1_HIT'; realized=pnl; }
      const patch:any = { current_price:current, unrealized_pnl:status === 'open' ? pnl : 0, status };
      if (status === 'closed') { patch.realized_pnl=realized; patch.closed_at=new Date().toISOString(); patch.close_reason=closeReason; }
      await base44.entities.Trade.update(t.id, patch);
      reconciled.push({ trade_id:t.id, symbol:t.symbol, current_price:current, unrealized_pnl:pnl, status, close_reason:closeReason || null, provenance:provenance(s) });
    }

    if (reconciled.length) {
      await base44.entities.AuditLog.create({
        event:'E2E_PAPER_POSITION_PNL_RECONCILED', category:'TRADING', severity:'INFO', actor:'sniper_e2e',
        details:`${reconciled.length} open PAPER position(s) marked to live public market data`,
        metadata:{ reconciled, source:'LIVE_PUBLIC_REST', order_send:'BLOCKED', live_execution:'BLOCKED' }
      });
    }

    // Valid NO-TRADE outcome: never manufacture an A+ setup just to exercise order creation.
    if (!eligible.length) {
      await base44.entities.AuditLog.create({
        event:'E2E_PAPER_NO_TRADE', category:'RISK', severity:'INFO', actor:'sniper_e2e',
        details:'E2E stopped safely at A+ gate: no live signal has all 4 gates confirmed',
        metadata:{ decisions:signals.map(s => ({ exchange:s.exchange, symbol:s.symbol, decision:s.decision, score:s.ascan_score, rr:s.rr, data_fresh:s.data_fresh, all_four_gates:allFourGates(s), ...provenance(s) })), order_send:'BLOCKED', live_execution:'BLOCKED' }
      });
      return Response.json({
        status:'NO_TRADE', verdict:'SAFE_BLOCK_AT_A_PLUS_GATE',
        stages:{ live_exchange:'PASS', scanner:'PASS', a_plus_4_gates:'NO_SETUP', risk_gate:'NOT_REACHED', paper_order:'NOT_CREATED', position_pnl:reconciled.length ? 'PASS' : 'NO_OPEN_POSITION', audit_log:'PASS' },
        signals, reconciled, order_send:'BLOCKED', live_execution:'BLOCKED', latency_ms:Date.now()-started
      });
    }

    const s = eligible.sort((a,b) => (b.ascan_score || 0) - (a.ascan_score || 0))[0];
    const risk = await evaluateRiskGate(base44, {
      entry_price:s.entry_price, stop_loss:s.stop_loss, take_profit:s.take_profit_1, side:s.side,
      account_balance:PAPER_TEST_EQUITY, contract_size:1, volume_min:0.00001, volume_max:100, volume_step:0.00001,
      spread:Number(s.spread_pct || 0), max_spread_points:0.08, execution_mode:'PAPER'
    });
    await base44.entities.AuditLog.create({
      event:'E2E_PAPER_RISK_GATE', category:'RISK', severity:risk.pass ? 'INFO' : 'WARNING', actor:'sniper_e2e',
      details:`E2E Risk Gate ${risk.pass ? 'PASS' : 'FAIL'} — ${risk.reason}`,
      metadata:{ risk, provenance:provenance(s), paper_test_equity:PAPER_TEST_EQUITY, equity_type:'INTERNAL_NOMINAL_PAPER_EQUITY', order_send:'BLOCKED', live_execution:'BLOCKED' }
    });
    if (!risk.pass) {
      return Response.json({ status:'RISK_BLOCKED', verdict:'SAFE_BLOCK_AT_RISK_GATE', stages:{ live_exchange:'PASS', scanner:'PASS', a_plus_4_gates:'PASS', risk_gate:'FAIL', paper_order:'NOT_CREATED', position_pnl:reconciled.length ? 'PASS' : 'NO_OPEN_POSITION', audit_log:'PASS' }, signal:s, risk_gate:risk, reconciled, order_send:'BLOCKED', live_execution:'BLOCKED' });
    }

    const fingerprint = `SNIPER:${s.exchange}:${s.symbol}:${s.side}:${s.signal_candle_close_time}`;
    const duplicate = trades.some((t:any) => t.mode === 'PAPER' && t.status === 'open' && t.signal_id === fingerprint);
    if (duplicate) {
      await base44.entities.AuditLog.create({ event:'E2E_PAPER_DUPLICATE_BLOCKED', category:'RISK', severity:'INFO', actor:'sniper_e2e', details:`Duplicate PAPER signal blocked: ${fingerprint}`, metadata:{ fingerprint, provenance:provenance(s), order_send:'BLOCKED', live_execution:'BLOCKED' } });
      return Response.json({ status:'DUPLICATE_BLOCKED', verdict:'SAFE_DUPLICATE_BLOCK', stages:{ live_exchange:'PASS', scanner:'PASS', a_plus_4_gates:'PASS', risk_gate:'PASS', paper_order:'DUPLICATE_BLOCKED', position_pnl:reconciled.length ? 'PASS' : 'NO_OPEN_POSITION', audit_log:'PASS' }, signal:s, risk_gate:risk, order_send:'BLOCKED', live_execution:'BLOCKED' });
    }

    const size = Number(risk.details?.position_size || 0);
    const riskAmount = PAPER_TEST_EQUITY * (Number(risk.details?.risk_per_trade || 0.5) / 100);
    const trade = await base44.entities.Trade.create({
      symbol:s.symbol, exchange:String(s.exchange).toLowerCase(), side:s.side, mode:'PAPER', status:'open', signal_id:fingerprint,
      ascan_score:s.ascan_score, entry_price:s.entry_price, current_price:s.entry_price, stop_loss:s.stop_loss, take_profit:s.take_profit_1,
      size, position_value:Math.round(s.entry_price * size * 100) / 100, risk_amount:Math.round(riskAmount * 100) / 100,
      leverage:1, realized_pnl:0, unrealized_pnl:0, rr:s.rr, opened_at:new Date().toISOString()
    });
    await base44.entities.AuditLog.create({
      event:'E2E_PAPER_ORDER_CREATED', category:'TRADING', severity:'INFO', actor:'sniper_e2e',
      details:`Internal PAPER ${s.symbol} ${s.side} created after live A+ + risk gate PASS`,
      metadata:{ trade_id:trade.id, fingerprint, source:'LIVE_PUBLIC_REST', provenance:provenance(s), entry:s.entry_price, mark_price:s.current_market_price, stop_loss:s.stop_loss, take_profit:s.take_profit_1, size, risk_amount:riskAmount, paper_test_equity:PAPER_TEST_EQUITY, order_send:'BLOCKED', live_execution:'BLOCKED' }
    });

    return Response.json({
      status:'PAPER_ORDER_CREATED', verdict:'E2E_PAPER_PASS_TO_OPEN_POSITION',
      stages:{ live_exchange:'PASS', scanner:'PASS', a_plus_4_gates:'PASS', risk_gate:'PASS', paper_order:'PASS', position_pnl:'OPEN_ZERO_AT_ENTRY', audit_log:'PASS' },
      trade_id:trade.id, signal:s, provenance:provenance(s), risk_gate:risk, reconciled, execution_mode:'INTERNAL_PAPER_ONLY', paper_test_equity:PAPER_TEST_EQUITY,
      order_send:'BLOCKED', live_execution:'BLOCKED', latency_ms:Date.now()-started
    });
  } catch(e:any) {
    return Response.json({ status:'ERROR', error:e?.message || 'E2E_FAILED', order_send:'BLOCKED', live_execution:'BLOCKED' }, { status:500 });
  }
}
