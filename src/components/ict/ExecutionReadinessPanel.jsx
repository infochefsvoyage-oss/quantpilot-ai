// QuantPilot Execution Readiness Panel
// Zeigt den DRY RUN Status der Execution-Pipeline.
// READ-ONLY. Hebt Order-Send NIEMALS auf.

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import {
  ShieldCheck, Lock, Ban, Activity, Radio, Server,
  CheckCircle2, AlertTriangle,
} from "lucide-react";

export default function ExecutionReadinessPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [safetyTest, setSafetyTest] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("executionReadinessCheck", {});
      setData(res);
    } catch (e) {
      setData({ error: e.message, execution_readiness: "NOT_READY" });
    }
    setLoading(false);
  };

  const runSafetyTest = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke("orderSendSafetyTest", {});
      setSafetyTest(res);
    } catch (e) {
      setSafetyTest({ error: e.message, order_send: "REJECTED" });
    }
    setTesting(false);
  };

  useEffect(() => {
    runCheck();
  }, []);

  const readiness = data?.execution_readiness || "NOT_READY";
  const hb = data?.heartbeat || {};
  const tick = data?.tick_freshness || {};
  const acc = data?.account_sync || {};
  const pos = data?.position_sync || {};
  const bridgeOk = data?.bridge_contract === "PASS";

  return (
    <PanelCard
      title="Execution Readiness (DRY RUN)"
      action={
        <span className="flex items-center gap-1.5 rounded-md bg-loss/10 px-2.5 py-1 text-xs font-medium text-loss">
          <Lock className="h-3.5 w-3.5" />
          ORDER SEND: BLOCKED
        </span>
      }
    >
      {/* Readiness Status Banner */}
      <div className={`mb-3 rounded-md border px-3 py-2.5 ${readiness === "READY" ? "border-profit/30 bg-profit/5" : "border-warning/30 bg-warning/10"}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            EXECUTION READINESS
          </span>
          <span className={`font-mono text-sm font-bold ${readiness === "READY" ? "text-profit" : "text-warning"}`}>
            {readiness}
          </span>
        </div>
      </div>

      {/* Readiness Checks Grid */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <ReadinessCheck icon={Activity} label="Heartbeat" status={hb.status} detail={hb.age_s != null ? `${hb.age_s}s` : hb.reason || "—"} />
        <ReadinessCheck icon={Radio} label="Tick Freshness" status={tick.status} detail={tick.tick_age_ms != null ? `${tick.tick_age_ms}ms` : "—"} />
        <ReadinessCheck icon={ShieldCheck} label="Account Sync" status={acc.status} detail={acc.account_id || "—"} />
        <ReadinessCheck icon={Server} label="Position Sync" status={pos.status} detail={`${pos.positions_count || 0} pos`} />
        <ReadinessCheck icon={Server} label="Bridge Contract" status={data?.bridge_contract} detail={data?.bridge_tier || "—"} />
        <ReadinessCheck icon={Lock} label="Order Send" status="BLOCKED" detail="GOVERNANCE" />
      </div>

      {/* Heartbeat Details */}
      <div className="mt-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Heartbeat Details</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          <DetailItem label="Status" value={hb.status || "—"} color={hb.status === "FRESH" ? "profit" : "loss"} />
          <DetailItem label="Age" value={hb.age_s != null ? `${hb.age_s}s` : "—"} color={hb.age_s != null && hb.age_s <= 30 ? "profit" : "loss"} />
          <DetailItem label="Timeout" value={`${hb.timeout_s || 30}s`} color="muted" />
          <DetailItem label="Last HB" value={hb.last_heartbeat_at ? new Date(hb.last_heartbeat_at).toLocaleTimeString("de-DE") : "—"} color="muted" />
          <DetailItem label="Reason" value={hb.reason || "—"} color="muted" />
        </div>
      </div>

      {/* Tick Freshness Details */}
      <div className="mt-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Tick Freshness</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          <DetailItem label="Tick Age" value={tick.tick_age_ms != null ? `${tick.tick_age_ms}ms` : "—"} color={tick.tick_age_ms != null && tick.tick_age_ms <= 5000 ? "profit" : "loss"} />
          <DetailItem label="Threshold" value={`${tick.threshold_ms || 5000}ms`} color="muted" />
          <DetailItem label="Latest Tick" value={tick.latest_tick_timestamp ? new Date(tick.latest_tick_timestamp).toLocaleTimeString("de-DE") : "—"} color="muted" />
        </div>
      </div>

      {/* Account Sync Details */}
      <div className="mt-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Account Sync (READ ONLY)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          <DetailItem label="Account ID" value={acc.account_id || "—"} color="muted" />
          <DetailItem label="Balance" value={acc.balance != null ? `${acc.balance} ${acc.currency || ""}` : "—"} color="muted" />
          <DetailItem label="Equity" value={acc.equity != null ? `${acc.equity}` : "—"} color="muted" />
          <DetailItem label="Margin" value={acc.margin != null ? `${acc.margin}` : "—"} color="muted" />
          <DetailItem label="Free Margin" value={acc.free_margin != null ? `${acc.free_margin}` : "—"} color="muted" />
          <DetailItem label="Currency" value={acc.currency || "—"} color="muted" />
        </div>
      </div>

      {/* Position Sync Details */}
      <div className="mt-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">Position Sync (READ ONLY)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          <DetailItem label="Positions" value={pos.positions_count || 0} color="muted" />
          <DetailItem label="Status" value={pos.status || "—"} color={pos.status === "PASS" ? "profit" : "loss"} />
        </div>
        {pos.positions && pos.positions.length > 0 && (
          <div className="mt-2 space-y-1">
            {pos.positions.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-border bg-secondary/20 px-2 py-1 text-xs">
                <span className="font-mono">{p.symbol} {p.direction}</span>
                <span className="font-mono text-muted-foreground">size={p.size} entry={p.entry}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Send Safety Test */}
      <div className="mt-4 rounded-md border border-loss/20 bg-loss/5 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-loss">
            <Ban className="h-3.5 w-3.5" />
            Order Send Safety Test (NEGATIVE)
          </span>
          <button
            onClick={runSafetyTest}
            disabled={testing}
            className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            {testing ? "Teste..." : "Ausführen"}
          </button>
        </div>
        {safetyTest && (
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
            <DetailItem label="Order Send" value={safetyTest.order_send} color="loss" />
            <DetailItem label="Reason" value={safetyTest.reason} color="loss" />
            <DetailItem label="Server-Side" value={safetyTest.server_side_check} color={safetyTest.server_side_check === "PASS" ? "profit" : "loss"} />
            <DetailItem label="Dashboard-Side" value={safetyTest.dashboard_side_check} color={safetyTest.dashboard_side_check === "PASS" ? "profit" : "loss"} />
            <DetailItem label="Bridge" value={safetyTest.bridge_tier || "—"} color="muted" />
            <DetailItem label="Live Exec" value={safetyTest.live_execution_blocked ? "BLOCKED" : "UNBLOCKED"} color="loss" />
          </div>
        )}
        {safetyTest && (
          <div className="mt-2 flex items-start gap-2 rounded border border-profit/20 bg-profit/5 px-2 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-profit mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-profit">Sperre bestätigt.</span>{" "}
              {safetyTest.conclusion || "Order-Send wird serverseitig blockiert."}
            </p>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={runCheck}
          disabled={loading}
          className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          {loading ? "Prüfe..." : "Readiness neu prüfen"}
        </button>
      </div>

      {/* Notice */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-warning">DRY RUN — keine echten Orders.</span>{" "}
          Dieser Panel prüft ausschließlich Read/Status-Funktionen. Order-Send bleibt serverseitig BLOCKED.
        </p>
      </div>
    </PanelCard>
  );
}

function ReadinessCheck({ icon: Icon, label, status, detail }) {
  const pass = status === "FRESH" || status === "PASS" || status === "READY";
  const blocked = status === "BLOCKED";
  const color = blocked ? "loss" : pass ? "profit" : "loss";
  const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <div className="text-right">
        <div className={`font-mono text-xs font-bold ${colors[color]}`}>{status}</div>
        <div className="font-mono text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, color }) {
  const colors = { profit: "text-profit", loss: "text-loss", muted: "text-muted-foreground" };
  return (
    <div className="flex items-center justify-between rounded border border-border bg-secondary/20 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${colors[color] || "text-foreground"}`}>{value}</span>
    </div>
  );
}