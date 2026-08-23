// QuantPilot — Pre-Order Risk Gate (PHASE 5)
// Prüft vor jedem Order-Send: MAX_RISK_PER_TRADE, MAX_DAILY_LOSS,
// MAX_OPEN_POSITIONS, MAX_CONSECUTIVE_LOSSES, MAX_DRAWDOWN,
// POSITION_SIZE, SL_DISTANCE.
//
// PASS → nächstes Gate. FAIL → ORDER BLOCKED.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { evaluateRiskGate } from '../../shared/riskGate.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const signal = body.signal || null;

    const result = await evaluateRiskGate(base44, signal);

    await base44.entities.AuditLog.create({
      event: "RISK_GATE_CHECK",
      category: "RISK",
      severity: result.pass ? "INFO" : "WARNING",
      actor: "pre_order_risk_gate",
      details: `Risk Gate: ${result.pass ? "PASS" : "FAIL"} — ${result.reason}`,
      metadata: { ...result, order_send: "BLOCKED" },
    });

    return Response.json({
      risk_gate: result.pass ? "PASS" : "FAIL",
      ...result,
      order_send: "BLOCKED",
      live_execution: "BLOCKED",
    });
  } catch (error) {
    return Response.json({ error: error.message, risk_gate: "FAIL", order_send: "BLOCKED" }, { status: 500 });
  }
}