// QuantPilot — Auto-Order Pipeline (PHASE 7/8 — DRY RUN)
// Vollständige Gate-Kette: SIGNAL → STRATEGY VERSION → SIGNAL VALIDATION →
// RISK GATE → DUPLICATE CHECK → POSITION CHECK → MT5 HEALTH →
// ORDER SIZE → SL/TP VALIDATION → ORDER SEND (BLOCKED) →
// POSITION SYNC → RECONCILIATION → AUDIT LOG
//
// ORDER_SEND = BLOCKED. LIVE_EXECUTION = BLOCKED. DRY RUN ONLY.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, fetchJson, computeTickAgeMs, heartbeatFields } from '../../shared/mt5Bridge.ts';
import { STRATEGY_VERSION, PARAMETER_HASH, computeFingerprint } from '../../shared/forwardObservation.ts';
import { evaluateRiskGate } from '../../shared/riskGate.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const signal = body.signal || null;
    const tStart = Date.now();

    const gates: Record<string, { pass: boolean; reason: string; detail?: any }> = {
      strategy_version_check: { pass: false, reason: "" },
      signal_validation: { pass: false, reason: "" },
      risk_gate: { pass: false, reason: "" },
      duplicate_order_check: { pass: false, reason: "" },
      position_check: { pass: false, reason: "" },
      mt5_health: { pass: false, reason: "" },
      order_size_validation: { pass: false, reason: "" },
      sl_tp_validation: { pass: false, reason: "" },
      order_send: { pass: false, reason: "BLOCKED — GOVERNANCE_LOCK" },
      position_sync: { pass: false, reason: "NOT_EXECUTED" },
      reconciliation: { pass: false, reason: "NOT_EXECUTED" },
    };

    // 1. Strategy version check
    if (signal?.strategy_version && signal.strategy_version !== STRATEGY_VERSION) {
      gates.strategy_version_check = { pass: false, reason: "STRATEGY_VERSION_MISMATCH" };
    } else if (signal?.parameter_hash && signal.parameter_hash !== PARAMETER_HASH) {
      gates.strategy_version_check = { pass: false, reason: "PARAMETER_HASH_MISMATCH" };
    } else {
      gates.strategy_version_check = { pass: true, reason: `MATCH (${STRATEGY_VERSION})` };
    }

    // 2. Signal validation
    if (!signal || !signal.entry_price || !signal.stop_loss || !signal.take_profit) {
      gates.signal_validation = { pass: false, reason: "INVALID_SIGNAL" };
    } else if (signal.side === "LONG" && signal.stop_loss >= signal.entry_price) {
      gates.signal_validation = { pass: false, reason: "SL_GE_ENTRY" };
    } else if (signal.side === "SHORT" && signal.stop_loss <= signal.entry_price) {
      gates.signal_validation = { pass: false, reason: "SL_LE_ENTRY" };
    } else {
      gates.signal_validation = { pass: true, reason: "VALID" };
    }

    // 3. Risk gate
    const riskResult = await evaluateRiskGate(base44, signal);
    gates.risk_gate = { pass: riskResult.pass, reason: riskResult.reason, detail: riskResult.details };

    // 4. Duplicate order check
    if (signal?.entry_price) {
      const fp = computeFingerprint({
        symbol: signal.symbol || SYMBOL,
        signal_timestamp: signal.signal_timestamp || new Date().toISOString(),
        entry_timestamp: signal.entry_timestamp || new Date().toISOString(),
        entry_price: signal.entry_price,
        direction: signal.side || "LONG",
        strategy_version: signal.strategy_version || STRATEGY_VERSION,
      });
      const existing = await base44.entities.ForwardTrade.list("-created_date", 500);
      if (existing.some((t: any) => t.fingerprint === fp)) {
        gates.duplicate_order_check = { pass: false, reason: "DUPLICATE_DETECTED", detail: fp };
      } else {
        gates.duplicate_order_check = { pass: true, reason: "UNIQUE", detail: fp };
      }
    } else {
      gates.duplicate_order_check = { pass: false, reason: "NO_SIGNAL" };
    }

    // 5. Position check (max 1 open, no unknown positions)
    const openTrades = await base44.entities.Trade.list("-created_date", 50);
    const openCount = openTrades.filter((t: any) => t.status === "open").length;
    if (openCount > 0) {
      gates.position_check = { pass: false, reason: `POSITION_ALREADY_OPEN (${openCount})` };
    } else {
      gates.position_check = { pass: true, reason: "NO_OPEN_POSITIONS" };
    }

    // 6. MT5 health (heartbeat, tick, account, positions, bridge)
    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    if (!bridgeUrl) {
      gates.mt5_health = { pass: false, reason: "NO_BRIDGE_URL" };
    } else {
      const headers = apiKey ? { "X-API-Key": apiKey } : {};
      const base = bridgeUrl.replace(/\/+$/, "");
      const [ver, tick, hbRaw] = await Promise.all([
        fetchJson(`${base}/verification`, headers),
        fetchJson(`${base}/symbols/${SYMBOL}/tick`, headers),
        fetchJson(`${base}/heartbeat`, headers),
      ]);
      const verification = ver.json || {};
      const tickJ = tick.json || {};
      const hb = heartbeatFields(hbRaw.json || {});
      const tickAgeMs = computeTickAgeMs(tickJ);
      const tickFresh = tickAgeMs !== null && tickAgeMs <= 5000;
      const hbFresh = hb.heartbeat_fresh;
      const mt5Pass = verification.tick === true && verification.account === true && tickFresh && hbFresh;
      gates.mt5_health = {
        pass: mt5Pass,
        reason: mt5Pass ? "HEALTHY" : `tick=${tickFresh ? "FRESH" : "STALE"}, hb=${hbFresh ? "FRESH" : "STALE"}, ver=${verification.tick}/${verification.account}`,
      };
    }

    // 7. Order size validation
    if (signal?.entry_price && signal?.stop_loss) {
      const slDist = Math.abs(signal.entry_price - signal.stop_loss);
      gates.order_size_validation = {
        pass: slDist > 0,
        reason: slDist > 0 ? `VALID (sl_dist=${Math.round(slDist * 100) / 100})` : "ZERO_SL_DISTANCE",
      };
    } else {
      gates.order_size_validation = { pass: false, reason: "NO_SIGNAL" };
    }

    // 8. SL/TP validation (RR range 1.8-4.0)
    if (signal?.entry_price && signal?.stop_loss && signal?.take_profit) {
      const rr = Math.abs(signal.take_profit - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss);
      gates.sl_tp_validation = {
        pass: rr >= 1.8 && rr <= 4.0,
        reason: `RR=${rr.toFixed(2)}`,
      };
    } else {
      gates.sl_tp_validation = { pass: false, reason: "NO_SIGNAL" };
    }

    // 9-11. Order send, position sync, reconciliation — always BLOCKED
    gates.order_send = { pass: false, reason: "BLOCKED — GOVERNANCE_LOCK" };
    gates.position_sync = { pass: false, reason: "NOT_EXECUTED" };
    gates.reconciliation = { pass: false, reason: "NOT_EXECUTED" };

    const preOrderGates = ["strategy_version_check", "signal_validation", "risk_gate",
      "duplicate_order_check", "position_check", "mt5_health",
      "order_size_validation", "sl_tp_validation"];
    const allPreOrderPass = preOrderGates.every((k) => gates[k].pass);

    const result = {
      status: allPreOrderPass ? "ALL_GATES_PASS_BUT_ORDER_BLOCKED" : "GATES_FAILED",
      gates,
      strategy_version: STRATEGY_VERSION,
      parameter_hash: PARAMETER_HASH,
      order_send: "BLOCKED",
      live_execution: "BLOCKED",
      execution_mode: "DRY_RUN",
      latency_ms: Date.now() - tStart,
    };

    await base44.entities.AuditLog.create({
      event: "AUTO_ORDER_PIPELINE_DRY_RUN",
      category: "SYSTEM",
      severity: "INFO",
      actor: "auto_order_pipeline",
      details: `Auto-Order Pipeline DRY RUN: ${result.status} — Order Send: BLOCKED`,
      metadata: result,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, status: "ERROR", order_send: "BLOCKED" }, { status: 500 });
  }
}