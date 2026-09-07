import React, { useEffect, useState } from "react";
import { Crosshair, CheckCircle2, XCircle, ShieldCheck, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { decisionConfig, riskDefaults, formatPrice } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import GateIndicator from "@/components/GateIndicator";

const EMPTY = { id:"none", symbol:"—", exchange:"—", decision:"NO_TRADE", ascan_score:0, rr:0, htf_bias:"NEUTRAL", gate_liquidity_sweep:false, gate_reclaim_rejection:false, gate_volume_confirmation:false, gate_htf_alignment:false, spread_ok:false, funding_ok:false, data_fresh:false, stop_loss_present:false };

export default function SniperMode() {
  const [signals, setSignals] = useState([]);
  const [selectedSignal, setSelectedSignal] = useState(EMPTY);
  const [orderMode, setOrderMode] = useState("PAPER");
  const [feed, setFeed] = useState({ status:"LOADING", checked_at:null, error:null });
  const [loading, setLoading] = useState(true);
  const [orderState, setOrderState] = useState(null);

  const loadSignals = async () => {
    setLoading(true);
    try {
      const raw = await base44.functions.invoke("fetchSniperSignals", {});
      const res = raw?.data || raw;
      const next = Array.isArray(res?.signals) ? res.signals : [];
      setSignals(next);
      setSelectedSignal(prev => next.find(s => s.symbol === prev.symbol && s.exchange === prev.exchange) || next[0] || EMPTY);
      setFeed({ status:res?.status || "OFFLINE", checked_at:res?.checked_at || null, error:res?.error || null });
    } catch (e) {
      setSignals([]); setSelectedSignal(EMPTY);
      setFeed({ status:"OFFLINE", checked_at:null, error:e?.message || "SCAN_FAILED" });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSignals(); const id=setInterval(loadSignals, 30000); return()=>clearInterval(id); }, []);

  const gates = [
    { label:"Liquidity Sweep", passed:!!selectedSignal.gate_liquidity_sweep },
    { label:"Reclaim / Rejection", passed:!!selectedSignal.gate_reclaim_rejection },
    { label:"Volume Confirmation", passed:!!selectedSignal.gate_volume_confirmation },
    { label:"HTF Alignment", passed:!!selectedSignal.gate_htf_alignment },
  ];
  const gatesPassed = gates.filter(g=>g.passed).length;
  const isAPlus = selectedSignal.source_confirmed === true && selectedSignal.data_fresh === true && gatesPassed === 4 && selectedSignal.ascan_score >= 75 && selectedSignal.rr >= 2.5;
  const canPaper = orderMode === "PAPER" && isAPlus && selectedSignal.decision === "ENTER";

  const createPaperOrder = async () => {
    if (!canPaper) return;
    setOrderState({ status:"SUBMITTING" });
    try {
      const raw = await base44.functions.invoke("createSniperPaperOrder", { exchange:selectedSignal.exchange, symbol:selectedSignal.symbol });
      const res = raw?.data || raw;
      setOrderState(res);
      await loadSignals();
    } catch(e) { setOrderState({ status:"ERROR", reason:e?.message || "PAPER_CREATE_FAILED" }); }
  };

  const dc = decisionConfig[selectedSignal.decision] || decisionConfig.NO_TRADE;

  return <div className="min-h-full p-6">
    <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
      <div><h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2"><Crosshair className="h-6 w-6 text-primary"/>Sniper Mode</h1><p className="mt-1 text-sm text-muted-foreground">A+ Live-Setup-Erkennung · alle 4 Gates müssen erfüllt sein</p></div>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${feed.status === "LIVE" ? "border-profit/30 text-profit" : "border-loss/30 text-loss"}`}>{feed.status === "LIVE" ? <Wifi className="h-3.5 w-3.5"/>:<WifiOff className="h-3.5 w-3.5"/>}{feed.status}</div>
        <button onClick={loadSignals} disabled={loading} className="rounded-md border border-border p-2"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
        {["PAPER","SHADOW","LIVE"].map(m=><button key={m} onClick={()=>m!=="LIVE"&&setOrderMode(m)} disabled={m==="LIVE"} className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold ${orderMode===m?"bg-primary text-primary-foreground":m==="LIVE"?"border border-loss/30 bg-loss/5 text-loss/40 cursor-not-allowed":"border border-border bg-secondary"}`}>{m==="LIVE"&&"🔒 "}{m}</button>)}
      </div>
    </div>

    <div className="mb-4 rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
      Quelle: <b className="text-foreground">LIVE_PUBLIC_REST</b> · Binance/MEXC Candles + BookTicker · 30s Refresh · Auth/Order-API nicht verwendet · LIVE Execution <b className="text-loss">BLOCKED</b>{feed.checked_at ? ` · geprüft ${new Date(feed.checked_at).toLocaleTimeString("de-DE")}`:""}
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <PanelCard title="Gescannte Live-Signale" className="lg:col-span-1"><div className="space-y-2">
        {!signals.length && <div className="rounded-md border border-loss/30 bg-loss/5 p-3 text-xs text-loss">Keine bestätigten Live-Marktdaten. NO TRADE.{feed.error?` ${feed.error}`:""}</div>}
        {signals.map(s=>{const cfg=decisionConfig[s.decision]||decisionConfig.NO_TRADE;return <button key={s.id} onClick={()=>setSelectedSignal(s)} className={`w-full rounded-md border px-3 py-2.5 text-left ${selectedSignal.id===s.id?"border-primary bg-primary/10":"border-border bg-secondary/30"}`}><div className="flex justify-between"><div><span className="font-mono text-sm font-bold">{s.symbol}</span> <span className="text-xs text-muted-foreground">{s.exchange}</span></div><StatusBadge status={cfg.label} color={cfg.color}/></div><div className="mt-2 flex justify-between"><div className="flex gap-0.5">{[s.gate_liquidity_sweep,s.gate_reclaim_rejection,s.gate_volume_confirmation,s.gate_htf_alignment].map((g,i)=><span key={i} className={`h-1.5 w-1.5 rounded-full ${g?"bg-profit":"bg-loss"}`}/>)}</div><span className="font-mono text-xs text-muted-foreground">Score {s.ascan_score} · RR {Number(s.rr||0).toFixed(1)}</span></div></button>})}
      </div></PanelCard>

      <div className="lg:col-span-2 space-y-4">
        <PanelCard title="Signal Detail – A+ Gate Check"><div className="mb-4 flex justify-between"><div className="flex gap-3 items-center"><span className="font-mono text-xl font-bold">{selectedSignal.symbol}</span><StatusBadge status={selectedSignal.exchange} color="muted"/><StatusBadge status={selectedSignal.htf_bias} color={selectedSignal.htf_bias==="LONG"?"profit":selectedSignal.htf_bias==="SHORT"?"loss":"muted"}/></div><div className="text-right"><StatusBadge status={dc.label} color={dc.color}/><p className="mt-1 text-xs text-muted-foreground">{dc.desc}</p></div></div>
          <div className="grid grid-cols-2 gap-2">{gates.map(g=><GateIndicator key={g.label} label={g.label} passed={g.passed}/>)}</div>
          <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3"><div className="mb-2 flex justify-between"><span className="text-xs font-semibold text-muted-foreground">Zusätzliche Checks</span><span className={`font-mono text-xs ${isAPlus?"text-profit":"text-loss"}`}>{isAPlus?"A+ LIVE BESTÄTIGT":"NICHT A+ / NO TRADE"}</span></div><div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3"><CheckRow label="Spread OK" ok={!!selectedSignal.spread_ok}/><CheckRow label="Public Feed bestätigt" ok={selectedSignal.source_confirmed===true}/><CheckRow label="Daten frisch" ok={!!selectedSignal.data_fresh}/><CheckRow label="Stop Loss" ok={!!selectedSignal.stop_loss_present}/><CheckRow label="Score ≥ 75" ok={selectedSignal.ascan_score>=75}/><CheckRow label="RR ≥ 2.5" ok={selectedSignal.rr>=2.5}/></div></div>
        </PanelCard>

        <PanelCard title="Order Ticket · INTERNAL PAPER ONLY"><div className="grid grid-cols-2 gap-4 md:grid-cols-4"><OrderField label="Entry" value={formatPrice(selectedSignal.entry_price)}/><OrderField label="Stop Loss" value={formatPrice(selectedSignal.stop_loss)} color="loss"/><OrderField label="TP1 (40%)" value={formatPrice(selectedSignal.take_profit_1)} color="profit"/><OrderField label="TP2 (30%)" value={formatPrice(selectedSignal.take_profit_2)} color="profit"/></div><div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4"><OrderField label="TP3 (30%)" value={formatPrice(selectedSignal.take_profit_3)} color="profit"/><OrderField label="ASCAN Gate Score" value={selectedSignal.ascan_score}/><OrderField label="RR" value={Number(selectedSignal.rr||0).toFixed(2)}/><OrderField label="Risiko/Trade" value={`${riskDefaults.risk_per_trade}%`} color="primary"/></div>
          <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground"><b className="text-foreground">Safety:</b> Beim Klick erfolgt serverseitig ein neuer Live-Scan. Nur wenn alle A+-Gates erneut PASS sind, wird ein interner PAPER-Datensatz erzeugt. Es existiert in diesem Pfad kein Exchange-Order-Aufruf.</div>
          <div className="mt-4 flex gap-3"><button onClick={createPaperOrder} disabled={!canPaper || orderState?.status==="SUBMITTING"} className={`flex-1 rounded-md py-3 font-semibold text-sm ${canPaper?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground cursor-not-allowed"}`}>{orderState?.status==="SUBMITTING"?"SERVERSEITIGE A+ PRÜFUNG…":canPaper?"PAPER ORDER ERSTELLEN":"KEIN PAPER TRADE – A+ NICHT BESTÄTIGT"}</button><button onClick={()=>setOrderMode("SHADOW")} className="rounded-md border border-border bg-secondary px-4 py-3 text-sm">Watch Only</button></div>
          {orderState && orderState.status!=="SUBMITTING" && <div className={`mt-3 rounded-md px-3 py-2 text-xs ${orderState.status==="PAPER_ORDER_CREATED"?"bg-profit/5 text-profit":"bg-loss/5 text-loss"}`}>{orderState.status}{orderState.reason?` · ${orderState.reason}`:""}{orderState.trade_id?` · Trade ${orderState.trade_id}`:""}</div>}
          {!canPaper && <div className="mt-3 flex gap-2 rounded-md bg-loss/5 px-3 py-2"><XCircle className="h-4 w-4 shrink-0 text-loss"/><p className="text-xs text-loss">Fail-closed: Ohne 4/4 Live-Gates + frische Daten + Score ≥75 + RR ≥2.5 wird keine Paper-Position angelegt.</p></div>}
          {canPaper && <div className="mt-3 flex gap-2 rounded-md bg-profit/5 px-3 py-2"><ShieldCheck className="h-4 w-4 shrink-0 text-profit"/><p className="text-xs text-profit">A+ im angezeigten Scan bestätigt. Der Server muss das Setup beim Klick nochmals unabhängig bestätigen.</p></div>}
        </PanelCard>
      </div>
    </div>
  </div>;
}

function CheckRow({label,ok}){return <div className="flex items-center gap-1.5">{ok?<CheckCircle2 className="h-3.5 w-3.5 text-profit"/>:<XCircle className="h-3.5 w-3.5 text-loss"/>}<span className={ok?"text-foreground":"text-muted-foreground"}>{label}</span></div>}
function OrderField({label,value,color="muted"}){const c={muted:"text-foreground",profit:"text-profit",loss:"text-loss",primary:"text-primary"};return <div className="rounded-md border border-border bg-secondary/30 px-3 py-2"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-sm font-bold ${c[color]}`}>{value}</div></div>}
