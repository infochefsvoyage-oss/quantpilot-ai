import React from "react";
import { Clock, Globe } from "lucide-react";
import { ICT_KILLZONES, getCurrentKillzone } from "@/lib/ictData";

export default function KillzoneClock() {
  const current = getCurrentKillzone();
  const utcTime = new Date().toUTCString().split(" ")[4];

  const colorMap = {
    primary: "text-primary border-primary/30 bg-primary/10",
    accent: "text-accent border-accent/30 bg-accent/10",
    warning: "text-warning border-warning/30 bg-warning/10",
    muted: "text-muted-foreground border-border bg-secondary",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-heading text-sm font-semibold text-foreground">Killzone Tracker</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Globe className="h-3 w-3" />
          {utcTime} UTC
        </div>
      </div>

      <div className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${colorMap[current.color]}`}>
        <div>
          <div className="font-mono text-xs uppercase tracking-wider opacity-70">Aktiv</div>
          <div className="font-heading text-sm font-bold">{current.label}</div>
        </div>
        <div className="font-mono text-xs opacity-70">
          {current.name === "OFF" ? "—" : `${current.start}–${current.end} UTC`}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {ICT_KILLZONES.map((kz) => {
          const active = kz.name === current.name;
          return (
            <div
              key={kz.name}
              className={`rounded border px-2 py-1.5 text-center transition-colors ${
                active ? colorMap[kz.color] : "border-border bg-secondary/30 text-muted-foreground"
              }`}
            >
              <div className="font-mono text-[10px] font-bold uppercase">{kz.name}</div>
              <div className="font-mono text-[9px] opacity-60">{kz.start}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}