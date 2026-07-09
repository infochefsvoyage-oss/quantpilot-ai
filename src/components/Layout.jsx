import React, { useState, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Crosshair, Briefcase, ShieldAlert, Lock,
  BookOpen, Plug, FlaskConical, Radio, Settings, Zap, Activity,
  Radar, Shield, TrendingDown,
} from "lucide-react";
import { runtimeStatus } from "@/lib/quantData";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sniper", label: "Sniper Mode", icon: Crosshair },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/risk", label: "Risiko", icon: ShieldAlert },
  { to: "/governance", label: "Governance", icon: Lock },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/exchange", label: "Exchange Setup", icon: Plug },
  { to: "/backtest", label: "Backtest", icon: FlaskConical },
  { to: "/live-feed", label: "Live Feed", icon: Radio },
  { to: "/arb-scan", label: "ARB-Scan", icon: Radar },
  { to: "/runner", label: "Runner", icon: Shield },
  { to: "/reverse-short", label: "Reverse-Short", icon: TrendingDown },
  { to: "/settings", label: "Einstellungen", icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const [emergency, setEmergency] = useState(runtimeStatus.emergency_stop);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-border bg-sidebar-background">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 glow-cyan">
            <Zap className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-sm font-bold tracking-tight text-foreground">QuantPilot AI</div>
            <div className="font-mono text-[10px] text-primary">OP-777 SNIPER DESK</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-l-2 border-primary bg-sidebar-accent text-primary font-medium"
                    : "border-l-2 border-transparent text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${runtimeStatus.ascan_engine === "ACTIVE" ? "bg-profit animate-pulse" : "bg-loss"}`} />
            <span className="font-mono text-muted-foreground">ASCAN: {runtimeStatus.ascan_engine}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${runtimeStatus.governance_engine === "ACTIVE" ? "bg-profit animate-pulse" : "bg-loss"}`} />
            <span className="font-mono text-muted-foreground">ULF: {runtimeStatus.governance_engine}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Modus</span>
              <span className="rounded bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary glow-cyan">
                {runtimeStatus.mode}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Phase</span>
              <span className="rounded bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground">
                {runtimeStatus.exchange_phase}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Daten-Lag</span>
              <span className="font-mono text-xs text-muted-foreground">{runtimeStatus.data_lag_ms}ms</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {emergency && (
              <div className="flex items-center gap-2 rounded-md bg-loss/15 px-3 py-1.5 glow-red">
                <ShieldAlert className="h-4 w-4 text-loss" />
                <span className="font-mono text-xs font-bold text-loss">EMERGENCY STOP AKTIV</span>
              </div>
            )}
            <button
              onClick={() => setEmergency(!emergency)}
              className="flex items-center gap-2 rounded-md border border-loss/30 bg-loss/10 px-4 py-2 text-xs font-semibold text-loss transition-colors hover:bg-loss/20 glow-red"
            >
              <ShieldAlert className="h-4 w-4" />
              Emergency Stop
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}