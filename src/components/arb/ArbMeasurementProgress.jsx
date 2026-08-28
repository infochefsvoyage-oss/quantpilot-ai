import React, { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Database, Gauge, Lock, ShieldAlert, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

const REQUIRED = 100;

function isGenuineEconomicallyProfitable(opp) {
  return Boolean(
    opp?.source_type === "LIVE_CEX" &&
    opp?.data_health === "HEALTHY" &&
    opp?.feed_health === "HEALTHY" &&
    opp?.freshness_valid === true &&
    opp?.clock_sync_valid === true &&
    opp?.orderbook_slippage_valid === true &&
    opp?.adverse_selection_gate === "PASS" &&
    opp?.inventory_gate === "PASS" &&
    typeof opp?.net_profit_percent === "number" &&
    opp.net_profit_percent > 0 &&
    opp?.is_profitable_after_costs === true &&
    opp?.paper_execution_status === "COMPLETED" &&
    opp?.dex_execution_mode !== "RESEARCH_ONLY"
  );
}

function gateStatus(opportunities, predicate) {
  return opportunities.length > 0 && opportunities.every(predicate) ? "PASS" : "PENDING";
}

export default function ArbMeasurementProgress() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.entities.ArbOpportunity.list("-created_date", 500)
      .then((items) => {
        if (!active) return;
        setRecords(Array.isArray(items) ? items : []);
        setError(false);
      })
      .catch(() => {
        if (!active) return;
        setRecords([]);
        setError(true);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const genuine = useMemo(() => records.filter(isGenuineEconomicallyProfitable), [records]);
  const progress = Math.min(100, Math.round((genuine.length / REQUIRED) * 100));
  const ready = genuine.length >= REQUIRED;

  const gates = [
    ["DATA QUALITY", gateStatus(genuine, (o) => o.data_health === "HEALTHY" && o.feed_health === "HEALTHY")],
    ["FRESHNESS", gateStatus(genuine, (o) => o.freshness_valid === true)],
    ["LATENCY", gateStatus(genuine, (o) => typeof o.latency_ms === "number" && o.latency_ms >= 0)],
    ["CLOCK SYNC", gateStatus(genuine, (o) => o.clock_sync_valid === true)],
    ["SLIPPAGE", gateStatus(genuine, (o) => o.orderbook_slippage_valid === true)],
    ["FEES / COSTS", gateStatus(genuine, (o) => o.is_profitable_after_costs === true && typeof o.taker_fee_percent === "number")],
    ["ADVERSE SELECTION", gateStatus(genuine, (o) => o.adverse_selection_gate === "PASS")],
    ["INVENTORY", gateStatus(genuine, (o) => o.inventory_gate === "PASS")],
    ["NET PROFIT", gateStatus(genuine, (o) => typeof o.net_profit_percent === "number" && o.net_profit_percent > 0)],
    ["PAPER", gateStatus(genuine, (o) => o.paper_execution_status === "COMPLETED")],
  ];

  return (
    <PanelCard title="ARB V1.2 — Live Measurement Track">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Genuine wirtschaftlich profitable Opportunities</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={loading ? "LOADING" : error ? "DATA UNAVAILABLE" : ready ? "100+ VERIFIED" : `${genuine.length}/${REQUIRED}`} color={ready ? "profit" : error ? "loss" : "warning"} />
            <StatusBadge status="AUTO ORDER OFF" color="loss" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Metric icon={Database} label="Genuine / Ziel" value={`${genuine.length} / ${REQUIRED}`} />
          <Metric icon={Gauge} label="Fortschritt" value={`${progress}%`} />
          <Metric icon={Activity} label="Gesamt erfasst" value={records.length} />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>100-Opportunity Evidence Gate</span><span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {gates.map(([label, status]) => (
            <div key={label} className="rounded-md border border-border bg-secondary/20 p-2">
              <div className="text-[9px] font-semibold text-muted-foreground">{label}</div>
              <div className="mt-1"><StatusBadge status={status} color={status === "PASS" ? "profit" : "warning"} /></div>
            </div>
          ))}
        </div>

        <div className={`rounded-md border p-3 ${ready ? "border-profit/30 bg-profit/5" : "border-warning/30 bg-warning/5"}`}>
          <div className="flex items-start gap-2">
            {ready ? <CheckCircle2 className="h-4 w-4 text-profit" /> : <ShieldAlert className="h-4 w-4 text-warning" />}
            <div className="text-xs leading-relaxed text-muted-foreground">
              {ready
                ? "Evidence Gate bestanden: mindestens 100 genuine LIVE_CEX Opportunities sind nach Daten-, Kosten-, Risiko- und Paper-Gates wirtschaftlich positiv validiert."
                : `Noch nicht freigegeben: ${Math.max(0, REQUIRED - genuine.length)} genuine wirtschaftlich profitable Opportunities fehlen. Lokale Demo-/Fallback-Daten zählen nicht.`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3" /> DEX = RESEARCH_ONLY · Live Order = BLOCKED · AUTO_ORDER = FALSE
        </div>
      </div>
    </PanelCard>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
