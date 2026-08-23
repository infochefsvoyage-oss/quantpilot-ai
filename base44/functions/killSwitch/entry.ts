// QuantPilot — Automatic Kill Switch (PHASE 13)
// Prüft alle Kill-Bedingungen. Bei任意 KILL → ORDER_SEND = BLOCKED.
//
// Kill-Gründe: CI/Performance-Gate bricht, Daily Loss Limit, Max DD,
// Position Sync verloren, Tick stale, Bridge unhealthy, Strategy Hash verändert,
// unbekannte Position, Duplicate Order, Reconciliation FAIL, Datenintegrität FAIL.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, fetchJson, computeTickAgeMs, heartbeatFields } from '../../shared/mt5Bridge.ts';
import { STRATEGY_VERSION, PARAMETER_HASH } from '../../shared/forwardObservation.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const checks: Record<string, { kill: boolean; reason: string }> = {
      ci_performance_gate: { kill: false, reason: "" },
      daily_loss_limit: { kill: false, reason: "" },
      max_drawdown: { kill: false, reason: "" },
      position_sync: { kill: false, reason: "" },
      tick_stale: { kill: false, reason: "" },
      bridge_unhealthy: { kill: false, reason: "" },
      strategy_hash_mismatch: { kill: false, reason: "" },
      unknown_position: { kill: false, reason: "" },
      duplicate_order: { kill: false, reason: "" },
      reconciliation_fail: { kill: false, reason: "" },
      data_integrity_fail: { kill: false, reason: "" },
    };

    // 1. CI/Performance gate (from latest Phase 4 audit)
    const logs = await base44.entities.AuditLog.list("-created_date", 50);
    const phase4 = logs.find((l: any) => l.event === "NY_LONG_PHASE_4_OOS_VALIDATION");
    const p4m = phase4?.metadata?.validation || phase4?.metadata || {};
    const ci = p4m.ci_95 || [0, 0];
    const power = p4m.power || 0;
    const n = p4m.trade_count || 0;
    if (n >= 82 && (ci[0] <= 0 || power < 0.8)) {
      checks.ci_performance_gate = { kill: true, reason: `CI=[${ci[0]},${ci[1]}], Power=${power}` };
    }

    // 2-3. Daily loss + Max drawdown
    const settings = await base44.entities.RiskSettings.list("-created_date", 1);
    const r = settings[0] || {};
    const today = new Date().toISOString().split("T")[0];
    const trades = await base44.entities.Trade.list("-created_date", 200);
    const todayTrades = trades.filter((t: any) => t.opened_at?.startsWith(today));
    const dailyPnl = todayTrades.reduce((s: number, t: any) => s + (t.realized_pnl || 0), 0);
    if (dailyPnl <= -(r.daily_loss_limit || 1.5)) {
      checks.daily_loss_limit = { kill: true, reason: `Daily PnL=${dailyPnl} <= limit=${r.daily_loss_limit}` };
    }

    const closed = trades.filter((t: any) => t.status === "closed");
    let run = 0, peak = 0, maxDD = 0;
    for (const t of [...closed].reverse()) {
      run += t.realized_pnl || 0;
      if (run > peak) peak = run;
      const dd = peak - run;
      if (dd > maxDD) maxDD = dd;
    }
    if (maxDD >= (r.max_drawdown_pause || 6)) {
      checks.max_drawdown = { kill: true, reason: `DD=${maxDD} >= limit=${r.max_drawdown_pause}` };
    }

    // 4-6. MT5 health
    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    if (!bridgeUrl) {
      checks.bridge_unhealthy = { kill: true, reason: "NO_BRIDGE_URL" };
      checks.tick_stale = { kill: true, reason: "NO_BRIDGE" };
      checks.position_sync = { kill: true, reason: "NO_BRIDGE" };
    } else {
      const headers = apiKey ? { "X-API-Key": apiKey } : {};
      const base = bridgeUrl.replace(/\/+$/, "");
      const [ver, tick, pos, hbRaw] = await Promise.all([
        fetchJson(`${base}/verification`, headers),
        fetchJson(`${base}/symbols/${SYMBOL}/tick`, headers),
        fetchJson(`${base}/positions`, headers),
        fetchJson(`${base}/heartbeat`, headers),
      ]);
      const tickJ = tick.json || {};
      const tickAgeMs = computeTickAgeMs(tickJ);
      if (tickAgeMs === null || tickAgeMs > 5000) {
        checks.tick_stale = { kill: true, reason: `tick_age=${tickAgeMs}` };
      }
      const hb = heartbeatFields(hbRaw.json || {});
      if (!hb.heartbeat_fresh) {
        checks.bridge_unhealthy = { kill: true, reason: `heartbeat=${hb.heartbeat_state}` };
      }
      if (!pos.ok) {
        checks.position_sync = { kill: true, reason: "POSITION_SYNC_FAIL" };
      }
    }

    // 7. Strategy hash mismatch
    const fwdObs = await base44.entities.ForwardObservation.list("-created_date", 1);
    const lastFwd = fwdObs[0];
    if (lastFwd?.governance?.strategy_version && lastFwd.governance.strategy_version !== STRATEGY_VERSION) {
      checks.strategy_hash_mismatch = { kill: true, reason: `${lastFwd.governance.strategy_version} != ${STRATEGY_VERSION}` };
    }

    // 8. Unknown position (max 1 open)
    const openTrades = trades.filter((t: any) => t.status === "open");
    if (openTrades.length > 1) {
      checks.unknown_position = { kill: true, reason: `${openTrades.length} open positions (max 1)` };
    }

    // 9. Duplicate order
    const signalIds = openTrades.map((t: any) => t.signal_id).filter(Boolean);
    const uniqueIds = new Set(signalIds);
    if (uniqueIds.size < signalIds.length) {
      checks.duplicate_order = { kill: true, reason: "DUPLICATE_SIGNAL_ID" };
    }

    // 10. Reconciliation fail
    const reconLog = logs.find((l: any) => l.event === "EXECUTION_READINESS_CHECK");
    if (reconLog?.metadata?.bridge_contract === "FAIL") {
      checks.reconciliation_fail = { kill: true, reason: "BRIDGE_CONTRACT_FAIL" };
    }

    // 11. Data integrity
    if (p4m.data_integrity === "FAIL") {
      checks.data_integrity_fail = { kill: true, reason: "DATA_INTEGRITY_FAIL" };
    }

    const anyKill = Object.values(checks).some((c) => c.kill);
    const killReasons = Object.entries(checks)
      .filter(([, v]) => v.kill)
      .map(([k, v]) => `${k}: ${v.reason}`);

    const result = {
      kill_switch: anyKill ? "KILL" : "OK",
      order_send: "BLOCKED",
      live_execution: "BLOCKED",
      checks,
      kill_reasons: killReasons,
      checked_at: new Date().toISOString(),
    };

    if (anyKill) {
      await base44.entities.AuditLog.create({
        event: "KILL_SWITCH_TRIGGERED",
        category: "SECURITY",
        severity: "CRITICAL",
        actor: "kill_switch",
        details: `Kill Switch TRIGGERED: ${killReasons.join("; ")}`,
        metadata: result,
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, kill_switch: "KILL", order_send: "BLOCKED" }, { status: 500 });
  }
}