import React, { useEffect, useMemo, useState } from "react";
import { Radar, AlertTriangle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { evaluateDecision } from "@/lib/ictData";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import KillzoneClock from "@/components/ict/KillzoneClock";
import ICTSignalCard from "@/components/ict/ICTSignalCard";
import SignalDetail from "@/components/ict/SignalDetail";

export default function ICTScanner() {
  const [signals, setSignals] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [feed, setFeed] = useState({ status: "LOADING", scan_latency_ms: 0, block_reason: "Loading live candles…" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const resp = await base44.functions.invoke("fetchICTLiveSignals", {});
        const data = resp.data || resp;
        if (!mounted) return;
        const next = Array.isArray(data.signals) ? data.signals : [];
        setSignals(next);
        setFeed(data);
        setSelectedId((prev) => next.some((s) => s.id === prev) ? prev : next[0]?.id || null);
      } catch (e) {
        if (mounted) { setSignals([]); setFeed({ status: "ERROR_BLOCKED", scan_latency_ms: 0, block_reason: e?.message || "Live feed unavailable" }); }
      } finally { if (mounted) setLoading(false); }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const selected = signals.find((s) => s.id === selectedId);
  const paperEntries = useMemo(() => signals.filter((s) => evaluateDecision(s) === "PAPER_ENTRY").length, [signals]);
  const noTrades = useMemo(() => signals.filter((s) => evaluateDecision(s) === "NO_TRADE").length, [signals]);
  const connected = signals.length > 0 && signals.some((s) => s.source_confirmed);

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1"><Radar className="h-6 w-6 text-primary" /><h1 className="font-heading text-2xl font-bold text-foreground">ICT Market Scanner v2</h1><span className="rounded bg-loss/10 px-2 py-0.5 font-mono text-[10px] font-bold text-loss">LIVE DATA · EXECUTION BLOCKED</span></div>
        <p className="text-sm text-muted-foreground">Echte Binance/MEXC-Candles · ICT Hard Gates · keine Mock-Signale · kein Live Order-Send</p>
      </div>

      <div className={`mb-4 rounded-lg border p-4 ${connected ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">{connected ? <Wifi className="h-5 w-5 text-profit" /> : <WifiOff className="h-5 w-5 text-loss" />}<div><div className="flex items-center gap-2"><span className="font-heading text-sm font-semibold">Live Market Data</span><span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${connected ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>{loading ? "LOADING" : feed.status}</span></div><p className="mt-0.5 text-xs text-muted-foreground">{feed.block_reason || "Public REST connected; execution remains blocked."}</p></div></div>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />30s · {feed.scan_latency_ms || 0}ms</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="Live Signale" value={signals.length} color="primary" /><StatCard label="PAPER Entry" value={paperEntries} color="profit" /><StatCard label="NO TRADE (Hard Gates)" value={noTrades} color="loss" /><StatCard label="Live Execution" value="BLOCKED" color="loss" /></div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3"><div><KillzoneClock /></div><div className="lg:col-span-2"><PanelCard title="Live ICT Signale"><div className="space-y-2">{signals.length ? signals.map((s) => <ICTSignalCard key={s.id} signal={s} active={s.id === selectedId} onSelect={() => setSelectedId(s.id)} />) : <div className="rounded border border-loss/20 bg-loss/5 p-4 text-sm text-loss">NO DATA / NO TRADE — keine bestätigten Live-Signale verfügbar.</div>}</div></PanelCard></div></div>
      {selected && <SignalDetail signal={selected} />}
      <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3"><div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" /><p className="text-xs text-muted-foreground"><span className="font-semibold text-warning">Marktdaten live, Ausführung gesperrt.</span> News-, Risk- und Governance-Gates werden nicht aus Public REST abgeleitet und bleiben ohne separate Bestätigung FAIL. Ein hoher ICT/ASCAN Score kann diese Hard Gates nicht überstimmen.</p></div></div>
    </div>
  );
}

function StatCard({ label, value, color }) { const colors = { primary: "text-primary", profit: "text-profit", loss: "text-loss", warning: "text-warning" }; return <div className="rounded-lg border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-2 font-mono text-2xl font-bold ${colors[color]}`}>{value}</div></div>; }
