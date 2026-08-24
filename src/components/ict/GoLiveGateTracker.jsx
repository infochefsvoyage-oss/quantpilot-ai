// QuantPilot — Go-Live Gate Tracker (10 Gates → 06.09.2026)
// Displays all 10 Go-Live gates with status, phase, and criteria.
// 10/10 PASS = Full Auto Candidate. Anything less = NO FULL AUTO.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { ShieldCheck, Lock, AlertTriangle, CheckCircle2, XCircle, Clock, Target } from "lucide-react";

const GATE_DEFINITIONS = [
  { gate_id: "G1_MT5_E2E", gate_name: "MT5 E2E", phase: "GO-3", required_criteria: "14/14 E2E Checks PASS" },
  { gate_id: "G2_MARKET_DATA", gate_name: "Market Data", phase: "GO-3", required_criteria: "Stabil + Fresh" },
  { gate_id: "G3_STRATEGY", gate_name: "Strategy", phase: "GO-2", required_criteria: "A+ Score ≥ 75, RR 1.8–4.0" },
  { gate_id: "G4_BACKTEST", gate_name: "Backtest", phase: "GO-5", required_criteria: "100k+ Candles, OOS positiv" },
  { gate_id: "G5_OOS", gate_name: "OOS", phase: "GO-5", required_criteria: "Out-of-Sample positiv" },
  { gate_id: "G6_EXPECTANCY", gate_name: "Expectancy", phase: "GO-5", required_criteria: "≥ +0.30R, PF ≥ 1.30" },
  { gate_id: "G7_SHADOW", gate_name: "24h Shadow", phase: "GO-6", required_criteria: "24h stabil, 0 Incidents" },
  { gate_id: "G8_SEMI_AUTO", gate_name: "Semi-Auto", phase: "GO-7", required_criteria: "User Approval Flow" },
  { gate_id: "G9_CONTROLLED_LIVE", gate_name: "Controlled Live", phase: "GO-8", required_criteria: "20-30 Trades, 0 Incidents" },
  { gate_id: "G10_SAFETY", gate_name: "Safety/Governance", phase: "GO-9", required_criteria: "0 kritische Incidents" },
];

export default function GoLiveGateTracker() {
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const records = await base44.entities.GoLiveGate.list("-created_date", 50);
        if (active) { setGates(records || []); setLoading(false); }
      } catch {
        if (active) { setGates([]); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  const gateMap = {};
  for (const g of gates) { gateMap[g.gate_id] = g; }

  const passCount = GATE_DEFINITIONS.filter(g => gateMap[g.gate_id]?.status === "PASS").length;
  const totalCount = GATE_DEFINITIONS.length;
  const ready = passCount === totalCount;
  const inProgress = GATE_DEFINITIONS.some(g => gateMap[g.gate_id]?.status === "IN_PROGRESS");

  const statusConfig = {
    PASS: { icon: CheckCircle2, color: "profit", label: "PASS", glow: "glow-green" },
    FAIL: { icon: XCircle, color: "loss", label: "FAIL", glow: "glow-red" },
    IN_PROGRESS: { icon: Clock, color: "warning", label: "IN PROGRESS", glow: "glow-amber" },
    BLOCKED: { icon: Lock, color: "loss", label: "BLOCKED", glow: "" },
    PENDING: { icon: Clock, color: "muted", label: "PENDING", glow: "" },
  };

  return (
    <PanelCard
      title="Go-Live Gate Tracker — 06.09.2026"
      action={
        <span className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
          ready ? "bg-profit/10 text-profit" : inProgress ? "bg-warning/10 text-warning" : "bg-muted/10 text-muted-foreground"
        }`}>
          {ready ? <ShieldCheck className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
          {passCount}/{totalCount} PASS
        </span>
      }
    >
      {/* Overall status banner */}
      <div className={`mb-4 rounded-md border px-4 py-3 ${
        ready ? "border-profit/30 bg-profit/5 glow-green" : "border-warning/30 bg-warning/5"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${ready ? "text-profit" : "text-warning"}`} />
            <span className="font-heading text-sm font-bold text-foreground">
              {ready ? "FULL AUTO CANDIDATE — 10/10 PASS" : `${passCount}/${totalCount} Gates bestanden`}
            </span>
          </div>
          <span className={`font-mono text-xs font-semibold ${ready ? "text-profit" : "text-warning"}`}>
            {ready ? "GO-LIVE READY" : "NO FULL AUTO"}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {ready
            ? "Alle 10 Gates bestanden. Full Auto darf aktiviert werden (initial 0,25% Risk)."
            : "Full Auto bleibt BLOCKED bis alle 10 Gates PASS. Kein Live-Trading vor vollständigem Audit."}
        </p>
      </div>

      {/* Gate grid */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
        {GATE_DEFINITIONS.map((gdef) => {
          const gate = gateMap[gdef.gate_id];
          const status = gate?.status || "PENDING";
          const cfg = statusConfig[status] || statusConfig.PENDING;
          const StatusIcon = cfg.icon;
          return (
            <div
              key={gdef.gate_id}
              className={`rounded-md border bg-secondary/30 p-3 ${
                status === "PASS" ? "border-profit/20" :
                status === "FAIL" ? "border-loss/20" :
                status === "IN_PROGRESS" ? "border-warning/20" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-muted-foreground">{gdef.gate_id}</span>
                <StatusIcon className={`h-4 w-4 text-${cfg.color}`} />
              </div>
              <div className="mt-1.5 font-heading text-sm font-bold text-foreground">{gdef.gate_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{gdef.required_criteria}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`font-mono text-xs font-bold text-${cfg.color}`}>{cfg.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{gdef.phase}</span>
              </div>
              {gate?.evidence && (
                <div className="mt-1.5 truncate text-xs text-muted-foreground" title={gate.evidence}>
                  {gate.evidence}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live config preview */}
      <div className="mt-4 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Initiale Live-Konfiguration (geplant)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <ConfigItem label="Risk/Trade" value="0,25%" />
          <ConfigItem label="Max Positions" value="1" />
          <ConfigItem label="Daily Loss" value="1%" />
          <ConfigItem label="Instrumente" value="BTCUSD / XAUUSD" />
          <ConfigItem label="Timeframe" value="M1" />
          <ConfigItem label="HTF" value="M5 / M15" />
          <ConfigItem label="A+ Score" value="≥ 75" />
          <ConfigItem label="Kill Switch" value="ON" />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-warning">06.09. = technisches Ziel, keine Profitabilitätsgarantie.</span>{" "}
          Full Auto wird nur freigegeben, wenn alle 10 Gates PASS. Profitabilität muss aus OOS-, Shadow- und Live-Daten entstehen.
        </p>
      </div>
    </PanelCard>
  );
}

function ConfigItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}