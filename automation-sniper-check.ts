import { scanAllLiveSniperSignals } from './base44/shared/sniperLive.ts';

(async()=>{
  const s:any[] = await scanAllLiveSniperSignals();
  console.log(JSON.stringify(s.map((x:any)=>({
    exchange:x.exchange,
    symbol:x.symbol,
    decision:x.decision,
    score:x.ascan_score,
    rr:x.rr,
    gates:[x.gate_liquidity_sweep,x.gate_reclaim_rejection,x.gate_volume_confirmation,x.gate_htf_alignment],
    fresh:x.data_fresh,
    source:x.source_confirmed,
    entry:x.entry_price,
    sl:x.stop_loss,
    tp1:x.take_profit_1,
    age:x.data_age_ms
  })),null,2));
})();
