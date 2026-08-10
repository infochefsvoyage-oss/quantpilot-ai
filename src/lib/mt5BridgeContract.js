// QuantPilot MT5 Bridge Contract v1
//
// REST-Vertrag zwischen QuantPilot und der externen FastAPI MT5-Bridge.
// WICHTIG: Die Bridge + das MT5-Terminal sind EXTERN und nicht Teil dieser
// Base44-App. Dieses Modul definiert nur den Vertrag (Endpunkte, Phasen,
// Heartbeat-Schwellen, Execution-Guard). Es stellt keine echte Verbindung her.
// MT5-Credentials bleiben ausschließlich im Backend/Secret-Store.

import { eaArmGates, isLiveBlocked } from "@/lib/mt5Data";

export const BRIDGE_VERSION = "v1";
export const BRIDGE_BASE_PATH = "/api/v1/mt5";

export const bridgePhases = {
  READ_ONLY: "Phase A – Read Only",
  PAPER_SHADOW: "Phase B – Shadow",
  ORDER_VALIDATION: "Phase C – Order Validation",
  LIVE_EXECUTE: "Phase D – Live",
};

export const bridgeEndpoints = {
  health:        { method: "GET",  path: `${BRIDGE_BASE_PATH}/health`,                phase: "ANY",              desc: "Bridge-Healthcheck" },
  connection:    { method: "GET",  path: `${BRIDGE_BASE_PATH}/connection`,             phase: "ANY",              desc: "Verbindungsstatus (kein Passwort)" },
  account:       { method: "GET",  path: `${BRIDGE_BASE_PATH}/account`,              phase: "READ_ONLY",        desc: "Balance, Equity, Free Margin, Margin, Währung" },
  symbol:        { method: "GET",  path: `${BRIDGE_BASE_PATH}/symbols/{canonical}`,   phase: "READ_ONLY",        desc: "Echte MT5-Spezifikation (Bid/Ask/Spread/Tick/Contract/Volume/Stops/Freeze)" },
  positions:     { method: "GET",  path: `${BRIDGE_BASE_PATH}/positions`,             phase: "READ_ONLY",        desc: "Offene Positionen (Duplicate-Guard)" },
  heartbeat:     { method: "POST", path: `${BRIDGE_BASE_PATH}/heartbeat`,            phase: "READ_ONLY",        desc: "EA-Heartbeat – HEALTHY/WARNING/STALE" },
  validateOrder: { method: "POST", path: `${BRIDGE_BASE_PATH}/orders/validate`,       phase: "ORDER_VALIDATION", desc: "Order gegen Broker-Regeln prüfen – keine Order" },
  executeOrder:  { method: "POST", path: `${BRIDGE_BASE_PATH}/orders/execute`,        phase: "LIVE_EXECUTE",    desc: "Live-Order – GESPERRT bis Phase D + alle Gates grün" },
};

// Heartbeat-Schwellen (Sekunden)
export const heartbeatThresholds = {
  HEALTHY: 10,   // < 10s  → HEALTHY
  WARNING: 30,   // 10–30s → WARNING, > 30s → STALE
};

export function heartbeatState(ageSeconds) {
  if (ageSeconds == null) return "STALE";
  if (ageSeconds < heartbeatThresholds.HEALTHY) return "HEALTHY";
  if (ageSeconds <= heartbeatThresholds.WARNING) return "WARNING";
  return "STALE";
}

export const executeGateKeys = eaArmGates.map((g) => g.key);

// Execution-Guard – Reihenfolge der Block-Prüfungen (v1, Abschnitt 8)
export const executionGuardReasons = {
  NOT_CONNECTED: "connection.connected = false",
  HEARTBEAT_STALE: "heartbeat.healthy = false",
  RISK_NOT_APPROVED: "risk.approved = false",
  GOVERNANCE_NOT_APPROVED: "governance.approved = false",
  EMERGENCY_STOP: "emergency_stop aktiv",
  DUPLICATE_DETECTED: "duplicate_detected",
  ORDER_INVALID: "order_validation.valid = false",
  LIVE_EXECUTION_DISABLED: "live_execution_enabled = false",
};

// /orders/execute ist blockiert, wenn:
//   - live_execution_blocked = true
//   - Phase != LIVE_EXECUTE
//   - nicht alle 8 Gates grün sind
export function isExecuteBlocked(conn, gates, phase) {
  if (!conn || isLiveBlocked(conn)) return { blocked: true, reason: "LIVE_EXECUTION_DISABLED" };
  if (phase !== "LIVE_EXECUTE") return { blocked: true, reason: "LIVE_EXECUTION_DISABLED" };
  const missing = executeGateKeys.filter((k) => gates[k] !== true);
  if (missing.length > 0) return { blocked: true, reason: "GATES_NOT_GREEN", missing };
  return { blocked: false, reason: "EXECUTION_ALLOWED" };
}

// Minimale Feld-Prüfung für /orders/validate (Schema-Referenz für das Backend)
export function validateOrderRequest(req) {
  const required = ["signal_id", "canonical", "side", "entry", "stop_loss", "take_profit", "lot", "strategy"];
  const missing = required.filter((f) => req[f] === undefined || req[f] === null);
  return { ok: missing.length === 0, missing };
}