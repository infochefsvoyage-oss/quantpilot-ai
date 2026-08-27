import React, { useState, useEffect } from "react";
import { Radio, Activity } from "lucide-react";
import { liveFeedEvents } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function LiveFeed() {
  const [events, setEvents] = useState(liveFeedEvents);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const types = ["TICK", "SCAN", "SIGNAL", "ORDER", "RISK", "GOVERNANCE"];
      const exchanges = ["BINANCE", "MEXC", "SYSTEM"];
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT"];
      const prices = ["61250.5", "3142.8", "148.2", "38.4"];
      const now = new Date();
      const newEvent = {
        id: `evt_${Date.now()}`,
        time: now.toLocaleTimeString("de-DE", { hour12: false }),
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        type: types[Math.floor(Math.random() * types.length)],
        message: `BTCUSDT ${prices[Math.floor(Math.random() * prices.length)]} | Vol ${Math.floor(Math.random() * 2000)}`,
        severity: Math.random() > 0.85 ? "WARNING" : "INFO",
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 50));
    }, 3000);
    return () => clearInterval(interval);
  }, [paused]);

  return (
    <div className="min-h-full p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            Live Feed
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Echtzeit-Event-Stream – Redis Pub/Sub Simulation</p>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          className="rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-secondary/70"
        >
          {paused ? "Fortsetzen" : "Pausieren"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FeedStat label="Events / Min" value={paused ? "0" : "20"} color={paused ? "muted" : "primary"} />
        <FeedStat label="Letzte Latenz" value="142ms" color="profit" />
        <FeedStat label="Aktive Streams" value="2" unit="BINANCE · MEXC" />
        <FeedStat label="Status" value={paused ? "PAUSIERT" : "LIVE"} color={paused ? "warning" : "profit"} />
      </div>

      {/* Event Stream */}
      <PanelCard title="Event Stream" className="mt-4">
        <div className="max-h-[600px] space-y-1 overflow-y-auto scrollbar-thin">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-md border border-border/50 bg-secondary/20 px-3 py-2 hover:bg-secondary/40">
              <span className="font-mono text-xs text-muted-foreground shrink-0">{e.time}</span>
              <StatusBadge status={e.exchange} color={e.exchange === "BINANCE" ? "cyan" : e.exchange === "MEXC" ? "warning" : "muted"} />
              <StatusBadge status={e.type} color={e.severity === "WARNING" ? "warning" : "muted"} />
              <span className={`flex-1 text-sm ${e.severity === "WARNING" ? "text-warning" : "text-foreground"}`}>
                {e.message}
              </span>
              {e.severity === "WARNING" && <Activity className="h-3.5 w-3.5 text-warning shrink-0" />}
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

function FeedStat({ label, value, unit = "", color = "muted" }) {
  const colors = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", primary: "text-primary", warning: "text-warning" };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-xl font-bold ${colors[color]}`}>{value}</div>
      {unit && <div className="mt-1 text-xs text-muted-foreground">{unit}</div>}
    </div>
  );
}