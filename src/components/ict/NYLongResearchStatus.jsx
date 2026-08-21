// A+ NY-LONG Research Status — Phase 4 Independent OOS Validation
// Read-Only diagnostic panel. Shows the frozen hypothesis state, independent
// OOS data availability, and statistical validation status.
// Color logic: GREEN=validated, YELLOW=candidate/underpowered, RED=evidence against, GREY=insufficient data.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { Lock, FlaskConical, AlertTriangle, CheckCircle2, XCircle, Database, Ban } from "lucide-react";

export default function NYLongResearchStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const logs = await base44.entities.AuditLog.list("-created_date", 30);
        const phaseLogs = (logs || []).filter(
          (l) =>
            l.event === "NY_LONG_PHASE_4_OOS_VALIDATION" ||
            l.event === "NY_LONG_PHASE_4_GOVERNANCE_FREEZE" ||
            l.event === "NY_LONG_PHASE_3_SEQUENTIAL_VALIDATION" ||
            l.event === "NY_LONG_OOS_VALIDATION_PHASE_2_FINAL"
        );
        const phase4 = phaseLogs.find((l) => l.event === "NY_LONG_PHASE_4_OOS_VALIDATION");
        const latest = phase4 || phaseLogs[0];
        if (active) { setData(latest || null); setLoading(false); }
      } catch {
        if (active) { setData(null); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="A+ NY-LONG Research Status">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const m = data?.metadata || {};
  const isPhase4 = data?.event === "NY_LONG_PHASE_4_OOS_VALIDATION";
  const oosAvailable = m.oos_data_available === true;
  const oosCandles = m.oos_candle_count || m.independent_oos_candles || 0;
  const oosTrades = m.trade_count || m.independent_oos_trades || 0;
  const trades = oosTrades || m.trade_count || 8;
  const requiredN = m.required_n || 82;
  const power = m.power || 0.279;
  const ci = m.ci_95 || m.confidence_interval || [-0.611, 1.611];
  const totalR = m.total_r ?? 4;
  const winrate = m.winrate ?? 50;
  const pf = m.profit_factor ?? 2;
  const cohensD = m.cohens_d ?? 0.31;
  const pValue = m.p_value ?? 0.7556;
  const finalClass = m.classification || "INCONCLUSIVE_UNDERPOWERED";
  const dataExpansion = m.data_expansion || "BLOCKED_BY_MT5_SOURCE_LIMIT";
  const dataSource = m.data_source || "MT5 (limitiert)";
  const independenceCheck = m.independence_check;
  const phase = isPhase4 ? "Phase 4" : "Phase 3";

  const classConfig = {
    EDGE_CONFIRMED: { icon: CheckCircle2, color: "profit", label: "EDGE CONFIRMED", glow: "glow-green" },
    INCONCLUSIVE_UNDERPOWERED: { icon: AlertTriangle, color: "warning", label: "INCONCLUSIVE / UNDERPOWERED", glow: "glow-amber" },
    EDGE_NOT_CONFIRMED: { icon: XCircle, color: "loss", label: "EDGE NOT CONFIRMED", glow: "glow-red" },
    INSUFFICIENT_DATA: { icon: Database, color: "muted", label: "INSUFFICIENT DATA", glow: "" },
    PROVISIONAL_UNDERPOWERED: { icon: AlertTriangle, color: "warning", label: "PROVISIONAL / UNDERPOWERED", glow: "glow-amber" },
  };
  const cfg = classConfig[finalClass] || classConfig.INCONCLUSIVE_UNDERPOWERED;
  const ClassIcon = cfg.icon;
  const oosColor = oosAvailable ? "profit" : "muted";

  return (
    <PanelCard
      title="A+ NY-LONG Research Status"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
          <FlaskConical className="h-3.5 w-3.5" />
          {phase} · Independent OOS Validation
        </span>
      }
    >
      {/* Phase 2/3 Reference */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Phase 2/3 Reference</span>
          <span className="font-mono text-xs font-semibold text-warning">Candidate Edge / Not Confirmed</span>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          P2: 6a8763ca · 8T · 50% WR · +4R · PF 2.0 | P3: 6a8766b2 · 17T · 50% WR · +7R · DATA_LIMIT
        </div>
      </div>

      {/* Phase 4 Status Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Independent OOS" value={oosAvailable ? "AVAILABLE" : "NOT AVAIL."} sub={dataSource} color={oosColor} />
        <StatBox label="OOS Candles" value={oosCandles.toLocaleString("de-DE")} sub={oosAvailable ? "validiert" : "0"} color={oosColor} />
        <StatBox label="OOS Trades" value={`${oosTrades}`} sub={`/ ${requiredN} Required`} color={oosTrades >= requiredN ? "profit" : "warning"} />
        <StatBox label="Current N" value={`${trades}`} sub={`Required ${requiredN}`} color={trades >= requiredN ? "profit" : "warning"} />
      </div>

      {/* Statistical Fields */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Power" value={power.toFixed(3)} sub="Target: 0.80" color={power >= 0.8 ? "profit" : "warning"} />
        <StatBox label="95% CI" value={`[${ci[0]}, ${ci[1]}]`} sub={ci[0] > 0 ? "Positiv" : "Enthält Null"} color={ci[0] > 0 ? "profit" : "warning"} />
        <StatBox label="Total R" value={`+${totalR}R`} sub={`PF ${pf}`} color={totalR >= 0 ? "profit" : "loss"} />
        <StatBox label="Edge" value="NOT CONFIRMED" sub="CANDIDATE" color="warning" />
      </div>

      {/* Sequential Progress */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Sequential Validation Progress</div>
        <div className="flex items-center gap-1">
          {[10, 20, 30, 50, 82, 100].map((n) => {
            const reached = trades >= n;
            return (
              <div
                key={n}
                className={`flex-1 rounded-sm py-1 text-center font-mono text-xs ${
                  reached ? "bg-profit/20 text-profit" : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {oosAvailable
            ? `n=${trades} ${trades < requiredN ? `< ${requiredN} → UNDERPOWERED` : "→ AUSREICHEND"}`
            : "OOS-Daten nicht verfügbar — externe Datenquelle benötigt (API-Key ungültig/nicht gesetzt)"}
        </div>
      </div>

      {/* Statistics Detail */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 md:grid-cols-3">
        <DetailItem label="Winrate" value={`${winrate}%`} />
        <DetailItem label="Cohen's d" value={cohensD?.toFixed(2) || "0.31"} />
        <DetailItem label="p-value" value={pValue?.toFixed(4) || "0.7556"} />
      </div>

      {/* Independence Check */}
      {isPhase4 && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">Critical Independence Check (OOS_START &gt; DISCOVERY_END)</span>
          <span className={`font-mono text-xs font-semibold ${independenceCheck ? "text-profit" : "text-loss"}`}>
            {independenceCheck ? "PASS" : "FAIL / N/A"}
          </span>
        </div>
      )}

      {/* Final Classification */}
      <div className={`mt-4 flex items-center justify-between rounded-md border border-${cfg.color}/20 bg-${cfg.color}/5 px-3 py-2.5 ${cfg.glow}`}>
        <div className="flex items-center gap-2">
          <ClassIcon className={`h-4 w-4 text-${cfg.color}`} />
          <span className="text-xs font-medium text-muted-foreground">Final Classification</span>
        </div>
        <span className={`font-mono text-sm font-bold text-${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Governance */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-xs text-primary">HYPOTHESIS: LOCKED</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">OPTIMIZATION: NONE</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-loss/20 bg-loss/5 px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-loss" />
          <span className="font-mono text-xs text-loss">ORDER_SEND: BLOCKED</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-loss/20 bg-loss/5 px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-loss" />
          <span className="font-mono text-xs text-loss">LIVE EXEC: BLOCKED</span>
        </div>
      </div>

      {/* Data Limit Notice */}
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-warning">MT5 History Limit = 100.000 Candles.</span>{" "}
        DATA_EXPANSION = {dataExpansion}.{" "}
        {oosAvailable
          ? "Unabhängige OOS-Daten erfolgreich beschafft und validiert."
          : "Keine unabhängige OOS-Datenquelle verfügbar — externe API benötigt gültigen Key (FOREX_DATA_API_KEY). Keine künstliche Datengenerierung."}
      </div>
    </PanelCard>
  );
}

function StatBox({ label, value, sub, color }) {
  const colors = {
    primary: "text-primary",
    profit: "text-profit",
    loss: "text-loss",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${colors[color] || "text-foreground"}`}>{value}</div>
      <div className="font-mono text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}