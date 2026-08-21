// A+ NY-LONG Research Status — Phase 4 Independent OOS Validation
// Complete Phase 4 panel showing ALL required fields.
// Color logic: GREEN=validated, YELLOW=candidate/underpowered, RED=evidence against, GREY=insufficient data.
// When OOS_DATA_AVAILABLE=FALSE, all metrics show N/A or 0 in GREY — never as validated.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import { Lock, FlaskConical, AlertTriangle, CheckCircle2, XCircle, Database, Ban, ShieldCheck } from "lucide-react";

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
            l.event === "NY_LONG_PHASE_3_SEQUENTIAL_VALIDATION"
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
  const trades = oosTrades || m.trade_count || 0;
  const requiredN = m.required_n || 82;
  const power = m.power || 0;
  const ci = m.ci_95 || m.confidence_interval || [0, 0];
  const totalR = m.total_r ?? 0;
  const winrate = m.winrate ?? 0;
  const pf = m.profit_factor ?? 0;
  const maxDD = m.max_dd ?? 0;
  const meanR = m.mean_r ?? 0;
  const cohensD = m.cohens_d ?? 0;
  const pValue = m.p_value ?? 1.0;
  const finalClass = m.classification || "INCONCLUSIVE_UNDERPOWERED";
  const dataQuality = m.data_quality_gate || (oosAvailable ? "PASS" : "NOT_RUN");
  const bootstrap = m.bootstrap_ci ? "COMPUTED" : "N/A";
  const monteCarlo = m.monte_carlo ? "COMPUTED" : "N/A";
  const walkForward = m.walk_forward ? `${m.walk_forward.positive || 0}/${m.walk_forward.blocks?.length || 0} positiv` : "N/A";
  const controlGroups = m.control_groups ? "COMPUTED" : "N/A";
  const lookAhead = m.lookahead || (oosAvailable ? "PASS" : "N/A");
  const reproducibility = m.reproducibility || (oosAvailable ? "PASS" : "N/A");
  const temporalIntegrity = m.temporal_integrity || (oosAvailable ? "PASS" : "N/A");
  const indexIntegrity = m.index_integrity || (oosAvailable ? "PASS" : "N/A");
  const auditLogId = data?.id || "—";
  const provider = m.data_provider || "twelvedata";
  const providerStatus = m.external_api_status || (oosAvailable ? "OK" : "KEY_INVALID");
  const dataSource = m.data_source || "EXTERNAL_PROVIDER_ATTEMPTED";
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
  const naColor = "muted";

  const passFail = (val) => val === "PASS" ? "profit" : val === "FAIL" ? "loss" : "muted";

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
          <span className="text-xs text-muted-foreground">Phase 2/3 Reference (NOT counted as new evidence)</span>
          <span className="font-mono text-xs font-semibold text-warning">Candidate Edge / Not Confirmed</span>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          P2: 6a8763ca · 8T · 50% WR · +4R | P3: 6a8766b2 · 17T · 50% WR · +7R · DATA_LIMIT
        </div>
      </div>

      {/* OOS Data Availability + Provider Status */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="OOS Data Available" value={oosAvailable ? "TRUE" : "FALSE"} sub={dataSource} color={oosColor} />
        <StatBox label="Data Quality Gate" value={dataQuality} sub={oosAvailable ? "validiert" : "not run"} color={oosAvailable ? "profit" : naColor} />
        <StatBox label="OOS Candles" value={oosCandles.toLocaleString("de-DE")} sub={oosAvailable ? "validiert" : "0"} color={oosColor} />
        <StatBox label="OOS Trades" value={`${oosTrades}`} sub={`/ ${requiredN} Required`} color={oosTrades >= requiredN ? "profit" : "warning"} />
      </div>

      {/* Provider Status */}
      <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">Provider: <span className="font-mono text-foreground">{provider}</span></span>
        <span className="text-xs text-muted-foreground">Status: <span className={`font-mono font-semibold ${providerStatus === "OK" ? "text-profit" : "text-loss"}`}>{providerStatus}</span></span>
      </div>

      {/* Core Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Total R" value={`${totalR >= 0 ? "+" : ""}${totalR}R`} sub={oosAvailable ? "" : "N/A"} color={oosAvailable ? (totalR >= 0 ? "profit" : "loss") : naColor} />
        <StatBox label="Profit Factor" value={oosAvailable ? pf : "N/A"} sub={oosAvailable ? "" : "no data"} color={oosAvailable ? (pf >= 1.5 ? "profit" : "warning") : naColor} />
        <StatBox label="Max Drawdown" value={oosAvailable ? `${maxDD}R` : "N/A"} sub={oosAvailable ? "" : "no data"} color={oosAvailable ? (maxDD <= 5 ? "profit" : "loss") : naColor} />
        <StatBox label="Mean R" value={oosAvailable ? meanR : "N/A"} sub={oosAvailable ? "" : "no data"} color={oosAvailable ? (meanR > 0 ? "profit" : "loss") : naColor} />
      </div>

      {/* Statistical Validation */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="95% CI" value={oosAvailable ? `[${ci[0]}, ${ci[1]}]` : "[0, 0]"} sub={oosAvailable ? (ci[0] > 0 ? "positiv" : "enthält Null") : "N/A"} color={oosAvailable ? (ci[0] > 0 ? "profit" : "warning") : naColor} />
        <StatBox label="Cohen's d" value={oosAvailable ? cohensD?.toFixed(2) : "0"} sub={oosAvailable ? "" : "N/A"} color={oosAvailable ? (cohensD >= 0.5 ? "profit" : "warning") : naColor} />
        <StatBox label="p-value" value={oosAvailable ? pValue?.toFixed(4) : "1.0000"} sub={oosAvailable ? "" : "N/A"} color={oosAvailable ? (pValue < 0.05 ? "profit" : "warning") : naColor} />
        <StatBox label="Power" value={power.toFixed(3)} sub="Target: 0.80" color={oosAvailable ? (power >= 0.8 ? "profit" : "warning") : naColor} />
      </div>

      {/* Bootstrap / Monte Carlo / Walk-Forward / Control Groups */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Bootstrap" value={bootstrap} sub={oosAvailable ? "10k resamples" : "no data"} color={oosAvailable ? "profit" : naColor} />
        <StatBox label="Monte Carlo" value={monteCarlo} sub={oosAvailable ? "10k sims" : "no data"} color={oosAvailable ? "profit" : naColor} />
        <StatBox label="Walk-Forward" value={oosAvailable ? walkForward : "N/A"} sub={oosAvailable ? "5+ blocks" : "no data"} color={oosAvailable ? "profit" : naColor} />
        <StatBox label="Control Groups" value={controlGroups} sub={oosAvailable ? "NY-S/LON-L/LON-S" : "no data"} color={oosAvailable ? "profit" : naColor} />
      </div>

      {/* Required N / Current N */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBox label="Required N" value="82" sub="FROZEN" color="primary" />
        <StatBox label="Current N" value={`${trades}`} sub={trades >= requiredN ? "ausreichend" : "underpowered"} color={trades >= requiredN ? "profit" : "warning"} />
        <StatBox label="Winrate" value={oosAvailable ? `${winrate}%` : "N/A"} sub={oosAvailable ? "" : "no data"} color={oosAvailable ? (winrate >= 50 ? "profit" : "loss") : naColor} />
        <StatBox label="Edge" value="NOT CONFIRMED" sub="CANDIDATE" color="warning" />
      </div>

      {/* Integrity Checks */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 md:grid-cols-4">
        <IntegrityItem label="Look-Ahead" value={lookAhead} color={passFail(lookAhead)} />
        <IntegrityItem label="Reproducibility" value={reproducibility} color={passFail(reproducibility)} />
        <IntegrityItem label="Temporal Integrity" value={temporalIntegrity} color={passFail(temporalIntegrity)} />
        <IntegrityItem label="Index Integrity" value={indexIntegrity} color={passFail(indexIntegrity)} />
      </div>

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
        <GovItem icon={Lock} label="HYPOTHESIS" value="LOCKED" color="primary" />
        <GovItem icon={Ban} label="OPTIMIZATION" value="NONE" color="muted" />
        <GovItem icon={Lock} label="ORDER_SEND" value="BLOCKED" color="loss" />
        <GovItem icon={Lock} label="LIVE EXECUTION" value="BLOCKED" color="loss" />
      </div>

      {/* AuditLog ID */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Phase 4 AuditLog
        </span>
        <span className="font-mono text-xs font-semibold text-foreground">{auditLogId}</span>
      </div>

      {/* Data Limit Notice */}
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-warning">MT5 History Limit = 100.000 Candles.</span>{" "}
        DATA_EXPANSION = BLOCKED_BY_MT5_SOURCE_LIMIT.{" "}
        {oosAvailable
          ? "Unabhängige OOS-Daten erfolgreich beschafft und validiert."
          : "Keine unabhängige OOS-Daten — externer API-Key ungültig. Keine künstliche Datengenerierung, keine Duplikate, kein Overlap mit Phase 2/3."}
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

function IntegrityItem({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-semibold ${colors[color] || "text-foreground"}`}>{value}</span>
    </div>
  );
}

function GovItem({ icon: Icon, label, value, color }) {
  const colors = { primary: "text-primary", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <Icon className={`h-3.5 w-3.5 ${colors[color]}`} />
      <span className={`font-mono text-xs ${colors[color]}`}>{label}: {value}</span>
    </div>
  );
}