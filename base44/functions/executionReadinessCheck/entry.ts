// QuantPilot — Execution Readiness Check (DRY RUN)
// READ-ONLY: Prüft Heartbeat, Tick-Freshness, Account-Sync, Position-Sync, Bridge-Contract.
// Sendet KEINE Orders. Hebt die Order-Send-Sperre NIEMALS auf.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, FRESHNESS_THRESHOLD_MS, fetchJson, computeTickAgeMs, getServerTimeMs, heartbeatFields } from '../../shared/mt5Bridge.ts';

const HEARTBEAT_TIMEOUT_S = 30;

export default async function(req: Request): Promise<Response> {
  const tStart = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    const now = new Date().toISOString();

    // ── Bridge Contract Check ──────────────────────────────────────────
    if (!bridgeUrl) {
      const result = {
        execution_readiness: "NOT_READY",
        bridge_contract: "FAIL",
        bridge_tier: "UI_CONTRACT",
        heartbeat: { status: "STALE", fresh: false, reason: "NO_BRIDGE_URL" },
        tick_freshness: { status: "FAIL", tick_age_ms: null, threshold_ms: FRESHNESS_THRESHOLD_MS },
        account_sync: { status: "FAIL", account_id: null, reason: "NO_BRIDGE" },
        position_sync: { status: "FAIL", positions_count: 0, reason: "NO_BRIDGE" },
        order_send: "BLOCKED",
        live_authorization: "BLOCKED",
        live_execution_blocked: true,
        checked_at: now,
      };
      await logReadiness(base44, result);
      return Response.json(result);
    }

    const headers = apiKey ? { "X-API-Key": apiKey } : {};
    const base = bridgeUrl.replace(/\/+$/, "");

    // ── 1) Bridge Health ──────────────────────────────────────────────
    const health = await fetchJson(`${base}/health`, headers);
    if (!health.ok) {
      const result = {
        execution_readiness: "NOT_READY",
        bridge_contract: "FAIL",
        bridge_tier: "UI_CONTRACT",
        heartbeat: { status: "STALE", fresh: false, reason: `BRIDGE_UNREACHABLE_HTTP_${health.status}` },
        tick_freshness: { status: "FAIL", tick_age_ms: null, threshold_ms: FRESHNESS_THRESHOLD_MS },
        account_sync: { status: "FAIL", account_id: null, reason: "BRIDGE_UNREACHABLE" },
        position_sync: { status: "FAIL", positions_count: 0, reason: "BRIDGE_UNREACHABLE" },
        order_send: "BLOCKED",
        live_authorization: "BLOCKED",
        live_execution_blocked: true,
        checked_at: now,
      };
      await logReadiness(base44, result);
      return Response.json(result);
    }

    // ── 2) Read endpoints (parallel) — READ ONLY ──────────────────────
    const [ver, acc, tick, pos, hbRaw] = await Promise.all([
      fetchJson(`${base}/verification`, headers),
      fetchJson(`${base}/account`, headers),
      fetchJson(`${base}/symbols/${SYMBOL}/tick`, headers),
      fetchJson(`${base}/positions`, headers),
      fetchJson(`${base}/heartbeat`, headers),
    ]);

    const verification = ver.json || {};
    const account = (acc.json && acc.json.account) || {};
    const tickJ = tick.json || {};
    const positions = (pos.json && pos.json.positions) || [];
    const heartbeat = hbRaw.json || {};

    // ── 3) Heartbeat Check ─────────────────────────────────────────────
    const hb = heartbeatFields(heartbeat);
    const hbAgeS = hb.heartbeat_age_s;
    const heartbeatFresh = hb.heartbeat_fresh && (hbAgeS === null || hbAgeS <= HEARTBEAT_TIMEOUT_S);
    const heartbeatStatus = heartbeatFresh ? "FRESH" : "STALE";

    // ── 4) Tick Freshness Check ────────────────────────────────────────
    const tickAgeMs = computeTickAgeMs(tickJ);
    const tickFresh = tickAgeMs !== null && tickAgeMs <= FRESHNESS_THRESHOLD_MS;
    const tickStatus = tickFresh ? "PASS" : "FAIL";

    // ── 5) Account Sync (READ ONLY) ──────────────────────────────────
    const accountSyncOk = acc.ok && (account.balance != null || account.equity != null);
    const accountStatus = accountSyncOk ? "PASS" : "FAIL";

    // ── 6) Position Sync (READ ONLY) ─────────────────────────────────
    const positionSyncOk = pos.ok;
    const positionStatus = positionSyncOk ? "PASS" : "FAIL";

    // ── 7) Bridge Contract ────────────────────────────────────────────
    const bridgeTier = verification.tier || "BACKEND_CONNECTED";
    const bridgeContractOk = verification.tick === true && verification.account === true;

    // ── 8) Overall Readiness ──────────────────────────────────────────
    const allReady = heartbeatFresh && tickFresh && accountSyncOk && positionSyncOk && bridgeContractOk;
    const executionReadiness = allReady ? "READY" : "NOT_READY";

    const result = {
      execution_readiness: executionReadiness,
      bridge_contract: bridgeContractOk ? "PASS" : "FAIL",
      bridge_tier: bridgeTier,
      heartbeat: {
        status: heartbeatStatus,
        fresh: heartbeatFresh,
        age_s: hbAgeS,
        timeout_s: HEARTBEAT_TIMEOUT_S,
        last_heartbeat_at: heartbeat.last_heartbeat_at || null,
        reason: hb.heartbeat_reason,
      },
      tick_freshness: {
        status: tickStatus,
        tick_age_ms: tickAgeMs,
        threshold_ms: FRESHNESS_THRESHOLD_MS,
        latest_tick_timestamp: tickJ.time ? tickJ.time * 1000 : null,
        server_time_ms: getServerTimeMs(tickJ),
      },
      account_sync: {
        status: accountStatus,
        account_id: account.login || account.id || null,
        balance: account.balance ?? null,
        equity: account.equity ?? null,
        margin: account.margin ?? null,
        free_margin: account.free_margin ?? null,
        currency: account.currency || null,
      },
      position_sync: {
        status: positionStatus,
        positions_count: positions.length,
        positions: positions.map(p => ({
          ticket: p.ticket, symbol: p.symbol, direction: p.side,
          size: p.volume, entry: p.entry, sl: p.sl || null, tp: p.tp || null,
        })),
      },
      order_send: "BLOCKED",
      live_authorization: "BLOCKED",
      live_execution_blocked: true,
      checked_at: now,
      latency_ms: Date.now() - tStart,
    };

    await logReadiness(base44, result);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      execution_readiness: "NOT_READY",
      bridge_contract: "FAIL",
      order_send: "BLOCKED",
      live_authorization: "BLOCKED",
      live_execution_blocked: true,
      error: error.message,
      checked_at: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function logReadiness(base44: any, result: any) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      event: "EXECUTION_READINESS_CHECK",
      category: "SYSTEM",
      severity: "INFO",
      actor: "execution_readiness_check",
      details: `Execution Readiness: ${result.execution_readiness} — Order Send: BLOCKED — Live Auth: BLOCKED`,
      metadata: { ...result, order_send: "BLOCKED", live_authorization: "BLOCKED" },
    });
  } catch (_) {}
}