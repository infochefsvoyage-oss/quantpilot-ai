import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { scanLiveSniperSymbol } from '../../shared/sniperLive.ts';
import { evaluateRiskGate } from '../../shared/riskGate.ts';

const ALLOWED = new Set(['BINANCE:BTCUSDT','BINANCE:ETHUSDT','MEXC:SOLUSDT','BINANCE:DOGEUSDT']);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const exchange = String(body.exchange || '').toUpperCase();
    const symbol = String(body.symbol || '').toUpperCase();
    if (!ALLOWED.has(`${exchange}:${symbol}`)) return Response.json({ status:'BLOCKED', reason:'SYMBOL_NOT_ALLOWED', order_send:'BLOCKED', live_execution:'BLOCKED' }, { status:400 });

    // Mandatory server-side re-scan. Never trust the browser's displayed signal.
    const s: any = await scanLiveSniperSymbol(exchange, symbol);
    const all4 = s.gate_liquidity_sweep && s.gate_reclaim_rejection && s.gate_volume_confirmation && s.gate_htf_alignment;
    if (!s.source_confirmed || !s.data_fresh || !s.spread_ok || !s.stop_loss_present || !all4 || s.ascan_score < 75 || s.rr < 2.5 || s.decision !== 'ENTER') {
      await base44.entities.AuditLog.create({
        event:'SNIPER_PAPER_BLOCKED', category:'RISK', severity:'WARNING', actor:'sniper_paper_order',
        details:`${exchange} ${symbol} paper blocked: A+ live gates not confirmed`,
        metadata:{ exchange, symbol, decision:s.decision, score:s.ascan_score, rr:s.rr, source:s.source_type, data_fresh:s.data_fresh, order_send:'BLOCKED', live_execution:'BLOCKED' }
      });
      return Response.json({ status:'BLOCKED', reason:'A_PLUS_LIVE_GATES_NOT_CONFIRMED', signal:s, order_send:'BLOCKED', live_execution:'BLOCKED' });
    }

    // Global risk gate: 0.5% default, max-open-position/daily-loss/DD/consecutive-loss checks.
    // Equity is explicitly nominal PAPER equity until a real paper-account balance source is connected.
    const paperEquity = 10000;
    const risk:any = await evaluateRiskGate(base44, {
      entry_price:s.entry_price, stop_loss:s.stop_loss, take_profit:s.take_profit_1, side:s.side,
      account_balance:paperEquity, contract_size:1, volume_min:0.00001, volume_max:100, volume_step:0.00001,
      spread:Number(s.spread_pct || 0), max_spread_points:0.08
    });
    await base44.entities.AuditLog.create({ event:'SNIPER_PAPER_RISK_GATE', category:'RISK', severity:risk.pass ? 'INFO' : 'WARNING', actor:'sniper_paper_order', details:`Sniper PAPER Risk Gate ${risk.pass ? 'PASS' : 'FAIL'} — ${risk.reason}`, metadata:{ ...risk, paper_equity:paperEquity, equity_type:'INTERNAL_NOMINAL_PAPER_EQUITY', order_send:'BLOCKED', live_execution:'BLOCKED' } });
    if (!risk.pass) return Response.json({ status:'BLOCKED', reason:'RISK_GATE_FAIL', risk_gate:risk, signal:s, order_send:'BLOCKED', live_execution:'BLOCKED' });

    // Paper-only duplicate guard: same exchange/symbol/side and same source candle.
    const recent = await base44.entities.Trade.list('-created_date', 100);
    const fingerprint = `SNIPER:${exchange}:${symbol}:${s.side}:${s.signal_candle_close_time}`;
    const duplicate = recent.some((t:any) => t.mode === 'PAPER' && t.signal_id === fingerprint && t.status === 'open');
    if (duplicate) return Response.json({ status:'BLOCKED', reason:'DUPLICATE_PAPER_SIGNAL', fingerprint, order_send:'BLOCKED', live_execution:'BLOCKED' });

    const size = Number(risk.details?.position_size || 0);
    const riskAmount = paperEquity * (Number(risk.details?.risk_per_trade || 0.5) / 100);
    // Internal paper ledger only. This function contains no authenticated exchange client and no order endpoint.
    const trade = await base44.entities.Trade.create({
      symbol, exchange:exchange.toLowerCase(), mode:'PAPER', side:s.side, signal_id:fingerprint,
      entry_price:s.entry_price, current_price:s.entry_price, stop_loss:s.stop_loss, take_profit:s.take_profit_1,
      size, position_value:Math.round(s.entry_price * size * 100) / 100, risk_amount:Math.round(riskAmount * 100) / 100,
      leverage:1, rr:s.rr, ascan_score:s.ascan_score,
      status:'open', realized_pnl:0, unrealized_pnl:0, opened_at:new Date().toISOString()
    });
    await base44.entities.AuditLog.create({
      event:'SNIPER_PAPER_ORDER_CREATED', category:'TRADING', severity:'INFO', actor:'sniper_paper_order',
      details:`Internal PAPER ${symbol} ${s.side} created from confirmed live public market data`,
      metadata:{ trade_id:trade.id, fingerprint, exchange, symbol, entry:s.entry_price, sl:s.stop_loss, tp1:s.take_profit_1, tp2:s.take_profit_2, tp3:s.take_profit_3, size, risk_amount:riskAmount, paper_equity:paperEquity, score:s.ascan_score, rr:s.rr, source:s.source_type, order_send:'BLOCKED', live_execution:'BLOCKED' }
    });
    return Response.json({ status:'PAPER_ORDER_CREATED', trade_id:trade.id, fingerprint, signal:s, execution_mode:'INTERNAL_PAPER_ONLY', order_send:'BLOCKED', live_execution:'BLOCKED' });
  } catch(e:any) {
    return Response.json({ status:'ERROR', error:e?.message || 'PAPER_CREATE_FAILED', order_send:'BLOCKED', live_execution:'BLOCKED' }, { status:500 });
  }
}
