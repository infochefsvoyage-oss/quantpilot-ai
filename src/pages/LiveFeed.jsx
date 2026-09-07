import React, { useEffect, useMemo, useState } from "react";
import { Radio, Activity, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function LiveFeed() {
  const [events, setEvents] = useState([]);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState({ state: "LOADING", latency: 0, error: null });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (paused) return;
      const started = Date.now();
      try {
        const resp = await base44.functions.invoke("fetchSniperSignals", {});
        const data = resp.data || resp;
        if (!mounted) return;
        const now = new Date();
        const next = (data.signals || []).map((s) => ({
          id: `${s.id}-${data.checked_at}`,
          time: now.toLocaleTimeString("de-DE", { hour12: false }),
          exchange: s.exchange,
          type: s.source_confirmed ? (s.decision === "ENTER" ? "SIGNAL" : "SCAN") : "DATA",
          message: s.source_confirmed
            ? `${s.symbol} ${Number(s.entry_price || 0).toLocaleString("de-DE", { maximumFractionDigits: 5 })} · ${s.decision} · Gates ${[s.gate_liquidity_sweep,s.gate_reclaim_rejection,s.gate_volume_confirmation,s.gate_htf_alignment].filter(Boolean).length}/4 · Age ${Math.round((s.data_age_ms || 0)/1000)}s`
            : `${s.symbol} NO DATA / NO TRADE · ${s.error || "market data unavailable"}`,
          severity: s.source_confirmed && s.data_fresh ? "INFO" : "WARNING",
        }));
        setEvents((prev) => [...next, ...prev].slice(0, 100));
        setStatus({ state: data.status || "LIVE", latency: data.scan_latency_ms || Date.now() - started, error: null });
      } catch (e) {
        if (!mounted) return;
        setStatus({ state: "OFFLINE", latency: Date.now() - started, error: e?.message || "Live feed unavailable" });
        setEvents((prev) => [{ id: `error-${Date.now()}`, time: new Date().toLocaleTimeString("de-DE", { hour12: false }), exchange: "SYSTEM", type: "DATA", message: `NO DATA / NO TRADE · ${e?.message || "Live feed unavailable"}`, severity: "WARNING" }, ...prev].slice(0,100));
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [paused]);

  const streams = useMemo(() => new Set(events.filter((e) => e.exchange !== "SYSTEM").map((e) => e.exchange)).size, [events]);
  return (
    <div className="min-h-full p-6">
      <div className="mb-6 flex items-center justify-between"><div><h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2"><Radio className="h-6 w-6 text-primary" />Live Feed</h1><p className="mt-1 text-sm text-muted-foreground">Echte Binance/MEXC Scanner-Events · keine Zufalls-/Mock-Ticks</p></div><button onClick={() => setPaused(!paused)} className="rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-secondary/70">{paused ? "Fortsetzen" : "Pausieren"}</button></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><FeedStat label="Refresh" value={paused ? "PAUSE" : "30s"} color={paused ? "warning" : "primary"} /><FeedStat label="Scan-Latenz" value={`${status.latency}ms`} color={status.state === "OFFLINE" ? "loss" : "profit"} /><FeedStat label="Aktive Quellen" value={streams} unit="BINANCE · MEXC" /><FeedStat label="Status" value={paused ? "PAUSIERT" : status.state} color={status.state === "OFFLINE" ? "loss" : paused ? "warning" : "profit"} /></div>
      {status.error && <div className="mt-4 rounded border border-loss/20 bg-loss/5 p-3 text-xs text-loss">{status.error}</div>}
      <PanelCard title="Live Event Stream" className="mt-4"><div className="max-h-[600px] space-y-1 overflow-y-auto scrollbar-thin">{events.length ? events.map((e) => <div key={e.id} className="flex items-center gap-3 rounded-md border border-border/50 bg-secondary/20 px-3 py-2"><span className="font-mono text-xs text-muted-foreground shrink-0">{e.time}</span><StatusBadge status={e.exchange} color={e.exchange === "BINANCE" ? "cyan" : e.exchange === "MEXC" ? "warning" : "muted"} /><StatusBadge status={e.type} color={e.severity === "WARNING" ? "warning" : "muted"} /><span className={`flex-1 text-sm ${e.severity === "WARNING" ? "text-warning" : "text-foreground"}`}>{e.message}</span>{e.severity === "WARNING" && <Activity className="h-3.5 w-3.5 text-warning shrink-0" />}</div>) : <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Live-Daten werden geladen…</div>}</div></PanelCard>
    </div>
  );
}
function FeedStat({ label, value, unit = "", color = "muted" }) { const colors = { muted:"text-foreground",profit:"text-profit",loss:"text-loss",primary:"text-primary",warning:"text-warning" }; return <div className="rounded-lg border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-2 font-mono text-xl font-bold ${colors[color]}`}>{value}</div>{unit && <div className="mt-1 text-xs text-muted-foreground">{unit}</div>}</div>; }
