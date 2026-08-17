// QuantPilot – Live Reconciliation: BRIDGE == QUANTPILOT == DASHBOARD
// Jede Abweichung wird als DataMismatch protokolliert. Keine automatische Korrektur.

export function reconcileTick(bridgeTick, dashboardTick) {
  if (!bridgeTick || !dashboardTick) return { match: false, field: "tick", reason: "missing" };
  const fields = ["bid", "ask", "spread"];
  const mismatches = [];
  for (const f of fields) {
    const b = bridgeTick[f];
    const d = dashboardTick[f];
    if (b == null || d == null) continue;
    if (Math.abs(b - d) > 1e-5) {
      mismatches.push({ field: `tick.${f}`, bridge_value: String(b), quantpilot_value: String(d), dashboard_value: String(d), severity: "CRITICAL" });
    }
  }
  return { match: mismatches.length === 0, mismatches };
}

export function reconcileAccount(bridgeAccount, dashboardAccount) {
  if (!bridgeAccount || !dashboardAccount) return { match: false, field: "account", reason: "missing" };
  const fields = ["balance", "equity", "margin", "free_margin"];
  const mismatches = [];
  for (const f of fields) {
    const b = bridgeAccount[f];
    const d = dashboardAccount[f];
    if (b == null || d == null) continue;
    if (Math.abs(b - d) > 1e-2) {
      mismatches.push({ field: `account.${f}`, bridge_value: String(b), quantpilot_value: String(d), dashboard_value: String(d), severity: "WARNING" });
    }
  }
  return { match: mismatches.length === 0, mismatches };
}

export function reconcilePositions(bridgePositions, dashboardPositions) {
  const bIds = new Set((bridgePositions || []).map(p => p.ticket));
  const dIds = new Set((dashboardPositions || []).map(p => p.ticket));
  const mismatches = [];
  for (const id of bIds) if (!dIds.has(id)) mismatches.push({ field: "positions.missing_in_dashboard", bridge_value: String(id), quantpilot_value: "—", dashboard_value: "—", severity: "WARNING" });
  for (const id of dIds) if (!bIds.has(id)) mismatches.push({ field: "positions.missing_in_bridge", bridge_value: "—", quantpilot_value: String(id), dashboard_value: String(id), severity: "CRITICAL" });
  return { match: mismatches.length === 0, mismatches };
}

export function fullReconciliation(bridge, dashboard) {
  const tick = reconcileTick(bridge?.tick, dashboard?.tick);
  const account = reconcileAccount(bridge?.account, dashboard?.account);
  const positions = reconcilePositions(bridge?.positions, dashboard?.positions);
  const allMismatches = [...tick.mismatches, ...account.mismatches, ...positions.mismatches];
  return {
    match: tick.match && account.match && positions.match,
    tick, account, positions,
    mismatches: allMismatches,
    timestamp: new Date().toISOString(),
  };
}