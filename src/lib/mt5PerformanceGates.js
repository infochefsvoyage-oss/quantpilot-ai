// QuantPilot – MT5 Performance & Freshness Gates
// Kanonische Schwellwerte für den Read-Only-Operational-Test. Das Dashboard darf niemals
// alte Daten als LIVE anzeigen — jede Abweichung wird als STALE/WARNING markiert.

export const FRESHNESS_THRESHOLDS = {
  TICK_FRESH_MS: 2000,
  TICK_STALE_MS: 5000,
  ACCOUNT_FRESH_MS: 10000,
  ACCOUNT_STALE_MS: 30000,
  POSITION_FRESH_MS: 10000,
  POSITION_STALE_MS: 30000,
  HEARTBEAT_HEALTHY_MS: 10000,
  HEARTBEAT_WARNING_MS: 30000,
};

export function tickGate(ageMs) {
  if (ageMs == null || ageMs < 0) return { state: "STALE", label: "TICK_STALE", ok: false };
  if (ageMs < FRESHNESS_THRESHOLDS.TICK_FRESH_MS) return { state: "FRESH", label: "TICK_FRESH", ok: true };
  if (ageMs < FRESHNESS_THRESHOLDS.TICK_STALE_MS) return { state: "DEGRADED", label: "TICK_DEGRADED", ok: false };
  return { state: "STALE", label: "TICK_STALE", ok: false };
}

export function accountGate(lastSyncMs) {
  if (lastSyncMs == null) return { state: "STALE", label: "ACCOUNT_STALE", ok: false };
  if (lastSyncMs < FRESHNESS_THRESHOLDS.ACCOUNT_FRESH_MS) return { state: "FRESH", label: "ACCOUNT_FRESH", ok: true };
  if (lastSyncMs < FRESHNESS_THRESHOLDS.ACCOUNT_STALE_MS) return { state: "DEGRADED", label: "ACCOUNT_DEGRADED", ok: false };
  return { state: "STALE", label: "ACCOUNT_STALE", ok: false };
}

export function positionGate(lastSyncMs) {
  if (lastSyncMs == null) return { state: "STALE", label: "POSITION_STALE", ok: false };
  if (lastSyncMs < FRESHNESS_THRESHOLDS.POSITION_FRESH_MS) return { state: "FRESH", label: "POSITION_FRESH", ok: true };
  if (lastSyncMs < FRESHNESS_THRESHOLDS.POSITION_STALE_MS) return { state: "DEGRADED", label: "POSITION_DEGRADED", ok: false };
  return { state: "STALE", label: "POSITION_STALE", ok: false };
}

export function heartbeatGate(state) {
  if (state === "HEALTHY") return { state: "HEALTHY", label: "HEARTBEAT_HEALTHY", ok: true };
  if (state === "WARNING") return { state: "WARNING", label: "HEARTBEAT_WARNING", ok: false };
  return { state: "STALE", label: "HEARTBEAT_STALE", ok: false };
}

export function evaluatePerformanceGates(snapshot) {
  if (!snapshot || !snapshot.reachable) {
    return { tick: tickGate(null), account: accountGate(null), positions: positionGate(null), heartbeat: heartbeatGate(null), overall: "STALE" };
  }
  const tick = tickGate(snapshot.tick_age_ms);
  const account = accountGate(snapshot.account_fresh ? 0 : null);
  const positions = positionGate(snapshot.positions_fresh ? 0 : null);
  const heartbeat = heartbeatGate(snapshot.heartbeat_state);
  const allFresh = tick.ok && account.ok && positions.ok && heartbeat.ok;
  const anyStale = !tick.ok || !heartbeat.ok;
  return { tick, account, positions, heartbeat, overall: allFresh ? "FRESH" : anyStale ? "STALE" : "DEGRADED" };
}