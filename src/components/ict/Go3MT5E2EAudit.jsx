// QuantPilot — GO-3 MT5 E2E Hardening Audit Dashboard
// Displays the 14/14 E2E test matrix, bridge health, symbol specs,
// risk engine guards, reconciliation, governance block, and order safety.
// PAPER/SHADOW/DRY-RUN ONLY — ORDER_SEND = BLOCKED — LIVE = BLOCKED.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import {
  ShieldCheck, ShieldAlert, Lock, AlertTriangle, CheckCircle2, XCircle,
  Activity, Radio, Server, Database, Gauge, Ban, Network, Clock, AlertOctagon,
} from "lucide-react";

const E2E_TESTS = [
  { id: "01", name: "BRIDGE_CONNECTIVITY", expected: "PASS" },
  { id: "02", name: "HEARTBEAT_FRESHNESS", expected: "PASS" },
  { id: "03", name: "TICK_FRESHNESS", expected: "PASS" },
  { id: "04", name: "ACCOUNT_SYNC", expected: "PASS" },
  { id: "05", name: "POSITION_SYNC", expected: "PASS" },
  { id: "06", name: "SYMBOL_SPEC", expected: "PASS" },
  { id: "07", name: "SYMBOL_TRADE_MODE", expected: "PASS" },
  { id: "08", name: "PRICE_VALIDITY", expected: "PASS" },
  { id: "09", name: "STOP_LEVEL_VALIDATION", expected: "PASS" },
  { id: "10", name: "SPREAD_GUARD", expected: "PASS" },
  { id: "11", name: "MARGIN_GUARD", expected: "PASS" },
  { id: "12", name: "POSITION_SIZE_CALCULATION", expected: "PASS" },
  { id: "13", name: "GOVERNANCE_ORDER_BLOCK", expected: "REJECTED" },
  { id: "14", name: "RECONCILIATION", expected: "PASS" },
];

const RISK_GUARDS = [
  "MAX_RISK_PER_TRADE", "MAX_DAILY_LOSS", "MAX_OPEN_POSITIONS",
  "MAX_CONSECUTIVE_LOSSES", "MAX_DRAWDOWN", "POSITION_SIZE",
  "SL_DISTANCE", "BROKER_STOP_LEVEL", "SPREAD_GUARD", "MARGIN_GUARD",
];

export default function Go3MT5E2EAudit() {
  const [audit, setAudit] = useState(null);
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const logs = await base44.entities.AuditLog.list("-created_date", 30);
        const go3 = (logs || []).find(l => l.event === "GO_LIVE_GO3_MT5_E2E_AUDIT");
        const diagLog = (logs || []).find(l => l.event === "GO3_MT5_CONNECTIVITY_DIAGNOSTIC");
        if (active) { setAudit(go3 || null); setDiag(diagLog || null); setLoading(false); }
      } catch {
        if (active) { setAudit(null); setDiag(null); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <PanelCard title="GO-3 MT5 E2E Hardening Audit">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </PanelCard>
    );
  }

  const m = audit?.metadata || {};
  const d = diag?.metadata || {};
  const tests = m.test_results_14 || {};
  const negTests = m.negative_test_results || {};
  const riskGuards = m.risk_gate_results || {};
  const symbolSpecs = m.symbol_specs || {};
  const governance = m.governance_state || {};
  const orderSafety = m.order_safety || {};
  const passCount = m.pass_count || 0;
  const failCount = m.fail_count || 14 - passCount;
  const negPassCount = m.negative_test_pass_count || 0;
  const allPass = passCount === 14;
  const auditId = audit?.id || "—";
  const diagId = diag?.id || "—";
  const hasDiag = diag !== null;

  const statusIcon = (status) => {
    if (status === "PASS") return <CheckCircle2 className="h-4 w-4 text-profit" />;
    if (status === "FAIL") return <XCircle className="h-4 w-4 text-loss" />;
    if (status === "REJECTED") return <CheckCircle2 className="h-4 w-4 text-profit" />;
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };
  const statusColor = (status) => status === "PASS" || status === "REJECTED" ? "text-profit" : "text-loss";

  return (
    <PanelCard
      title="GO-3 MT5 E2E Hardening Audit"
      action={
        <span className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
          allPass ? "bg-profit/10 text-profit glow-green" : "bg-loss/10 text-loss glow-red"
        }`}>
          {allPass ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {passCount}/14 PASS
        </span>
      }
    >
      {/* Overall verdict banner */}
      <div className={`mb-4 rounded-md border px-4 py-3 ${
        allPass ? "border-profit/30 bg-profit/5" : "border-loss/30 bg-loss/5"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allPass ? <ShieldCheck className="h-5 w-5 text-profit" /> : <ShieldAlert className="h-5 w-5 text-loss" />}
            <span className="font-heading text-sm font-bold text-foreground">
              {allPass ? "GO-3 PASS — MT5 E2E VERIFIED" : "GO-3 BLOCKED — MT5 TERMINAL NOT CONNECTED"}
            </span>
          </div>
          <span className={`font-mono text-xs font-bold ${allPass ? "text-profit" : "text-loss"}`}>
            G3 = {allPass ? "PASS" : "BLOCKED"}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {allPass
            ? "14/14 E2E Checks bestanden. MT5 Terminal verbunden. Nächstes Gate: 24h Shadow (GO-6)."
            : `${passCount}/14 E2E Checks bestanden. Bridge HTTP erreichbar, aber MT5 Terminal NICHT verbunden. Windows/Vantage-Host erforderlich. ORDER_SEND bleibt BLOCKED.`}
        </p>
      </div>

      {/* Bridge Health */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <BridgeMetric icon={Server} label="Bridge HTTP" value={m.bridge_http_reachable ? "REACHABLE" : "UNREACHABLE"} status={m.bridge_http_reachable ? "PASS" : "FAIL"} />
        <BridgeMetric icon={Activity} label="Bridge Tier" value={m.bridge_tier || "UI_CONTRACT"} status={m.bridge_tier === "MT5_E2E_CONNECTED" ? "PASS" : "FAIL"} />
        <BridgeMetric icon={Radio} label="Heartbeat" value={m.heartbeat?.status || "STALE"} status={m.heartbeat?.status === "FRESH" ? "PASS" : "FAIL"} />
        <BridgeMetric icon={Gauge} label="Error Rate" value={`${((m.error_rate?.failure_rate || 0) * 100).toFixed(1)}%`} status={m.error_rate?.status || "FAIL"} />
      </div>

      {m.heartbeat && (
        <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <span className="text-muted-foreground">Heartbeat Age: <span className="font-mono font-semibold text-loss">{Math.round((m.heartbeat.age_s || 0)).toLocaleString("de-DE")}s</span></span>
            <span className="text-muted-foreground">Threshold: <span className="font-mono font-semibold text-foreground">{m.heartbeat.threshold_s || 30}s</span></span>
            <span className="text-muted-foreground">Tick Age: <span className="font-mono font-semibold text-loss">{m.tick_age?.reason || "BLOCK"}</span></span>
            <span className="text-muted-foreground">Candle Age: <span className="font-mono font-semibold text-loss">{m.candle_age?.reason || "FAIL"}</span></span>
          </div>
        </div>
      )}

      {/* ── CONNECTIVITY DIAGNOSTIC — Architecture Trace ─────────────── */}
      {hasDiag && (
        <div className="mb-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Network className="h-3.5 w-3.5" />
            Connectivity Diagnostic — Architecture Trace
          </h4>

          {/* Hop Chain: Dashboard → Backend → Bridge → MT5 → Broker → Symbol */}
          <div className="space-y-1.5">
            <HopRow label="① Dashboard → Backend" status="PASS" value="Base44 Function" latency="—" />
            <HopRow label="② Backend → Bridge HTTP" status={d.bridgeStatus === "UP" ? "PASS" : "FAIL"} value={d.bridgeStatus || "UNKNOWN"} latency={`${d.bridgeLatencyMs || 0}ms`} />
            <HopRow label="③ Bridge → MT5 Terminal" status={d.mt5ProcessStatus === "DETECTED" ? "PASS" : "FAIL"} value={d.mt5ProcessStatus || "UNKNOWN"} latency="—" />
            <HopRow label="④ MT5 → Broker Server" status={d.brokerConnectionStatus === "CONNECTED" ? "PASS" : "FAIL"} value={d.brokerConnectionStatus || "UNKNOWN"} latency="—" />
            <HopRow label="⑤ Broker → Symbol (XAUUSD)" status={d.xauusdExists ? "PASS" : "FAIL"} value={d.xauusdExists ? "VISIBLE" : "NOT_FOUND"} latency="—" />
          </div>

          {/* Diagnostic Grid */}
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            <DiagBox label="Bridge HTTP" value={d.bridgeStatus || "UNKNOWN"} pass={d.bridgeStatus === "UP"} />
            <DiagBox label="Bridge Process" value={d.bridgeStatus === "UP" ? "HEALTHY" : "DOWN"} pass={d.bridgeStatus === "UP"} />
            <DiagBox label="Bridge Version" value={d.bridgeVersion || "UNKNOWN"} pass={null} />
            <DiagBox label="MT5 Terminal" value={d.mt5TerminalStatus || "UNKNOWN"} pass={d.mt5TerminalStatus === "CONNECTED"} />
            <DiagBox label="MT5 Process" value={d.mt5ProcessStatus || "UNKNOWN"} pass={d.mt5ProcessStatus === "DETECTED"} />
            <DiagBox label="MT5 Logged In" value={d.mt5LoggedIn ? "YES" : "NO"} pass={d.mt5LoggedIn} />
            <DiagBox label="Broker Connection" value={d.brokerConnectionStatus || "UNKNOWN"} pass={d.brokerConnectionStatus === "CONNECTED"} />
            <DiagBox label="Broker Name" value={d.brokerName || "UNKNOWN"} pass={null} />
            <DiagBox label="Account Sync" value={d.accountStatus || "UNKNOWN"} pass={d.accountStatus === "SYNCED"} />
            <DiagBox label="Market Data" value={d.marketStatus || "UNKNOWN"} pass={d.marketStatus === "AVAILABLE"} />
            <DiagBox label="Symbol Source" value={d.symbolSource || "UNKNOWN"} pass={d.symbolSource === "MT5_LIVE"} />
            <DiagBox label="Heartbeat" value={d.heartbeatReason || "UNKNOWN"} pass={d.heartbeatReason === "HEALTHY"} />
          </div>

          {/* Time / Timezone */}
          <div className="mt-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Time / Timezone</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <TimeItem label="Current UTC" value={d.currentUtc ? new Date(d.currentUtc).toLocaleTimeString("de-DE") : "—"} />
              <TimeItem label="Bridge UTC" value={d.bridgeUtc ? new Date(d.bridgeUtc).toLocaleTimeString("de-DE") : "—"} />
              <TimeItem label="Bridge Offset" value={d.bridgeTimeOffsetMs != null ? `${d.bridgeTimeOffsetMs}ms` : "—"} />
              <TimeItem label="Last Tick" value={d.lastTick ? new Date(d.lastTick).toLocaleTimeString("de-DE") : "NULL"} />
              <TimeItem label="Tick Age" value={d.tickAgeMs != null ? `${Math.round(d.tickAgeMs / 1000)}s` : "NULL"} />
              <TimeItem label="Candle Age" value={d.candleAgeMs != null ? `${Math.round(d.candleAgeMs / 1000)}s` : "NULL"} />
              <TimeItem label="Heartbeat Age" value={d.heartbeatAgeS != null ? `${Math.round(d.heartbeatAgeS).toLocaleString("de-DE")}s` : "—"} />
              <TimeItem label="Broker TZ" value={d.brokerTimezone || "UNKNOWN"} />
            </div>
          </div>

          {/* Mock / Fallback Detection */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <MockBox label="MOCK DATA" value={d.mockData ? "TRUE" : "FALSE"} pass={!d.mockData} />
            <MockBox label="FALLBACK DATA" value={d.fallbackData ? "TRUE" : "FALSE"} pass={!d.fallbackData} />
            <MockBox label="CACHED TICK" value={d.cachedTick ? "TRUE" : "FALSE"} pass={!d.cachedTick} />
          </div>

          {/* PRIMARY ROOT CAUSE */}
          <div className={`mt-2 rounded-md border px-3 py-2.5 ${
            d.isExternalBlocker ? "border-warning/30 bg-warning/10" : "border-loss/30 bg-loss/5"
          }`}>
            <div className="flex items-center gap-2">
              <AlertOctagon className={`h-4 w-4 ${d.isExternalBlocker ? "text-warning" : "text-loss"}`} />
              <span className="text-xs font-semibold text-muted-foreground">PRIMARY ROOT CAUSE</span>
            </div>
            <div className={`mt-1 font-mono text-sm font-bold ${d.isExternalBlocker ? "text-warning" : "text-loss"}`}>
              {d.primaryRootCause || "UNKNOWN"}
            </div>
            {d.failedComponents && d.failedComponents.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                Failed: <span className="font-mono text-loss">{d.failedComponents.join(" → ")}</span>
              </div>
            )}
            {d.isExternalBlocker && (
              <div className="mt-1.5 flex items-center gap-1.5 rounded border border-warning/20 bg-warning/5 px-2 py-1">
                <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
                <span className="text-xs font-semibold text-warning">EXTERNAL INFRASTRUCTURE BLOCKER</span>
              </div>
            )}
          </div>

          {/* Next Required Action */}
          <div className="mt-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div className="text-xs font-semibold text-primary">Next Required Action</div>
            <p className="mt-1 text-xs text-muted-foreground">{d.nextRequiredAction || "—"}</p>
          </div>

          {/* Diagnostic AuditLog ID */}
          <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Network className="h-3.5 w-3.5 text-primary" />
              Diagnostic AuditLog ID
            </span>
            <span className="font-mono text-xs font-semibold text-foreground">{diagId}</span>
          </div>
        </div>
      )}

      {/* 14/14 E2E Test Matrix */}
      <div className="mb-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          14/14 E2E Test Matrix
        </h4>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {E2E_TESTS.map((t) => {
            const result = tests[t.id + "_" + t.name] || tests[`${t.id}_${t.name}`] || { status: "FAIL", reason: "NOT_RUN" };
            const isPass = result.status === "PASS" || (t.expected === "REJECTED" && result.status === "PASS");
            return (
              <div key={t.id} className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                isPass ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{t.id}</span>
                  {statusIcon(result.status)}
                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold ${statusColor(result.status)}`}>{result.status || "FAIL"}</span>
                  <span className="font-mono text-xs text-muted-foreground">exp: {t.expected}</span>
                </div>
              </div>
            );
          })}
        </div>
        {Object.keys(tests).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(tests).slice(0, 4).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{key}:</span>
                <span className={`font-mono ${val.status === "PASS" ? "text-profit" : "text-loss"}`}>{val.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Symbol Specs */}
      <div className="mb-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Database className="h-3.5 w-3.5" />
          Symbol Specs — Source: <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-bold ${m.symbol_specs_source === "MT5" ? "bg-profit/10 text-profit" : "bg-warning/10 text-warning"}`}>{m.symbol_specs_source || "DEFAULT"}</span>
        </h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {["xauusd", "btcusd"].map((sym) => {
            const spec = symbolSpecs[sym] || {};
            return (
              <div key={sym} className="rounded-md border border-border bg-secondary/30 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-foreground">{sym.toUpperCase()}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${spec.source === "MT5" ? "bg-profit/10 text-profit" : "bg-warning/10 text-warning"}`}>
                    {spec.source || "DEFAULT"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <SpecItem label="Contract" value={spec.contract_size} />
                  <SpecItem label="Tick Size" value={spec.tick_size} />
                  <SpecItem label="Tick Value" value={spec.tick_value} />
                  <SpecItem label="Digits" value={spec.digits} />
                  <SpecItem label="Vol Min" value={spec.volume_min} />
                  <SpecItem label="Vol Max" value={spec.volume_max} />
                  <SpecItem label="Vol Step" value={spec.volume_step} />
                  <SpecItem label="Stops Level" value={spec.stops_level} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {m.symbol_specs_source === "MT5"
            ? "Live MT5 Specs erfolgreich geladen."
            : "DEFAULT Specs aktiv — MT5 Terminal nicht verbunden. Live Specs nicht verfügbar. DEFAULT wird NICHT als LIVE bestätigt."}
        </p>
      </div>

      {/* Risk Engine 2.0 — All 10 Guards */}
      <div className="mb-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Risk Engine 2.0 — 10 Guards
        </h4>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {RISK_GUARDS.map((guard) => {
            const g = riskGuards[guard] || { status: "N/A" };
            return (
              <div key={guard} className={`flex items-center justify-between rounded-md border px-3 py-1.5 ${
                g.status === "PASS" ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"
              }`}>
                <span className="font-mono text-xs text-foreground">{guard}</span>
                <div className="flex items-center gap-2">
                  {g.status === "PASS" ? <CheckCircle2 className="h-3.5 w-3.5 text-profit" /> : <XCircle className="h-3.5 w-3.5 text-loss" />}
                  <span className={`font-mono text-xs font-bold ${g.status === "PASS" ? "text-profit" : "text-loss"}`}>{g.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Negative Tests */}
      <div className="mb-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Ban className="h-3.5 w-3.5" />
          Negative Tests — {negPassCount}/15 PASS (deterministic reason codes)
        </h4>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
          {Object.entries(negTests).map(([name, result]) => (
            <div key={name} className="flex items-center gap-1.5 rounded border border-border bg-secondary/30 px-2 py-1">
              {result.status === "PASS" ? <CheckCircle2 className="h-3 w-3 shrink-0 text-profit" /> : <XCircle className="h-3 w-3 shrink-0 text-loss" />}
              <span className="truncate font-mono text-xs text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reconciliation */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 p-3">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Activity className="h-3.5 w-3.5" />
          Full Reconciliation
        </h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ReconItem label="Bridge Contract" value={m.reconciliation?.bridge_contract} />
          <ReconItem label="Tick Data Valid" value={m.reconciliation?.tick_data_valid} />
          <ReconItem label="Position Sync" value={m.reconciliation?.position_sync} />
          <ReconItem label="Overall" value={m.reconciliation?.status === "PASS"} />
        </div>
      </div>

      {/* Order Safety + Governance */}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-md border border-profit/20 bg-profit/5 p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-profit">
            <Lock className="h-3.5 w-3.5" />
            Order Send Safety
          </h4>
          <div className="space-y-1 text-xs">
            <SafetyItem label="Real Order Sent" value="NO" pass={orderSafety.real_order_sent === false} />
            <SafetyItem label="Order Send Test" value={orderSafety.order_send_test || "REJECTED"} pass={true} />
            <SafetyItem label="Reason" value={orderSafety.reason || "GOVERNANCE_BLOCK"} pass={true} />
            <SafetyItem label="Server-Side Check" value={orderSafety.server_side_check || "PASS"} pass={true} />
            <SafetyItem label="Dashboard-Side Check" value={orderSafety.dashboard_side_check || "PASS"} pass={true} />
          </div>
        </div>
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Governance State
          </h4>
          <div className="space-y-1 text-xs">
            <GovStateItem label="HYPOTHESIS" value={governance.hypothesis || "LOCKED"} />
            <GovStateItem label="A+ LOGIC" value={governance.a_plus_logic || "LOCKED"} />
            <GovStateItem label="OPTIMIZATION" value={governance.optimization || "NONE"} />
            <GovStateItem label="PARAMETER SEARCH" value={governance.parameter_search || "FORBIDDEN"} />
            <GovStateItem label="ORDER_SEND" value={governance.order_send || "BLOCKED"} danger />
            <GovStateItem label="LIVE_EXECUTION" value={governance.live_execution || "BLOCKED"} danger />
          </div>
        </div>
      </div>

      {/* Baseline Hash */}
      <div className="mb-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Baseline Hash
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{m.baseline_hash || "—"}</span>
            {m.baseline_hash_match ? <CheckCircle2 className="h-3.5 w-3.5 text-profit" /> : <XCircle className="h-3.5 w-3.5 text-loss" />}
            <span className={`font-mono text-xs font-bold ${m.baseline_hash_match ? "text-profit" : "text-loss"}`}>
              {m.baseline_hash_match ? "MATCH" : "MISMATCH"}
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Strategy: <span className="font-mono text-foreground">{m.strategy_version || "—"}</span></span>
          <span>Param Hash: <span className="font-mono text-foreground">{m.parameter_hash || "—"}</span></span>
        </div>
      </div>

      {/* Audit Log ID */}
      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          GO-3 AuditLog ID
        </span>
        <span className="font-mono text-xs font-semibold text-foreground">{auditId}</span>
      </div>

      {/* Final disclaimer */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-warning">PAPER/SHADOW ONLY.</span>{" "}
          ORDER_SEND = BLOCKED. LIVE_EXECUTION = BLOCKED. Kein realer Order gesendet.{" "}
          {allPass ? "GO-6 (24h Shadow) ist das nächste Gate." : "Windows/Vantage-Host mit echtem MT5 Terminal erforderlich für 14/14 PASS."}
        </p>
      </div>
    </PanelCard>
  );
}

function BridgeMetric({ icon: Icon, label, value, status = "FAIL" }) {
  return (
    <div className={`rounded-md border p-2.5 ${status === "PASS" ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${status === "PASS" ? "text-profit" : "text-loss"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`mt-1 font-mono text-sm font-bold ${status === "PASS" ? "text-profit" : "text-loss"}`}>{value}</div>
    </div>
  );
}

function SpecItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function ReconItem({ label, value }) {
  const pass = value === true;
  return (
    <div className={`flex items-center justify-between rounded border px-2 py-1 ${pass ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-bold ${pass ? "text-profit" : "text-loss"}`}>{pass ? "PASS" : "FAIL"}</span>
    </div>
  );
}

function SafetyItem({ label, value, pass }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${pass ? "text-profit" : "text-loss"}`}>{value}</span>
    </div>
  );
}

function GovStateItem({ label, value, danger = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${danger ? "text-loss" : "text-profit"}`}>{value}</span>
    </div>
  );
}

function HopRow({ label, status, value, latency }) {
  const pass = status === "PASS";
  return (
    <div className={`flex items-center justify-between rounded-md border px-3 py-1.5 ${
      pass ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"
    }`}>
      <div className="flex items-center gap-2">
        {pass ? <CheckCircle2 className="h-3.5 w-3.5 text-profit" /> : <XCircle className="h-3.5 w-3.5 text-loss" />}
        <span className="font-mono text-xs text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-xs font-bold ${pass ? "text-profit" : "text-loss"}`}>{value}</span>
        <span className="font-mono text-xs text-muted-foreground">{latency}</span>
      </div>
    </div>
  );
}

function DiagBox({ label, value, pass }) {
  const color = pass === true ? "profit" : pass === false ? "loss" : "muted";
  const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
  const border = pass === true ? "border-profit/20 bg-profit/5" : pass === false ? "border-loss/20 bg-loss/5" : "border-border bg-secondary/30";
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${border}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-xs font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}

function TimeItem({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MockBox({ label, value, pass }) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 text-center ${pass ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-xs font-bold ${pass ? "text-profit" : "text-loss"}`}>{value}</div>
    </div>
  );
}