// QuantPilot MT5 Bridge Contract v1
//
// REST-Schnittstelle zwischen QuantPilot und der externen FastAPI MT5-Bridge.
// Die Bridge kommuniziert mit dem MT5-Terminal (Vantage). /orders/execute ist
// technisch gesperrt, bis Phase 4 (LIVE_EXECUTE) erreicht ist UND alle Gates
// grün sind. Keine MT5-Credentials im Frontend – die Bridge hält sie im
// Secret-Manager / Environment.

import { eaArmGates, isLiveBlocked } from "@/lib/mt5Data";

export const BRIDGE_VERSION = "v1";

export const bridgePhases = {
  READ_ONLY: "Phase 1 – Read Only",
  PAPER_SHADOW: "Phase 2 – Paper/Shadow",
  ORDER_VALIDATION: "Phase 3 – Order Validation",
  LIVE_EXECUTE: "Phase 4 – Live Execution",
};

export const bridgeEndpoints = {
  health:        { method: "GET",  path: "/health",                phase: "ANY",              desc: "Bridge-Healthcheck" },
  status:        { method: "GET",  path: "/mt5/status",             phase: "ANY",              desc: "Verbindungsstatus (MT5Connection-Spiegel)" },
  connect:       { method: "POST", path: "/mt5/connect",           phase: "READ_ONLY",        desc: "Read-only Login ins MT5-Terminal" },
  disconnect:    { method: "POST", path: "/mt5/disconnect",        phase: "ANY",              desc: "Trennen der MT5-Verbindung" },
  account:       { method: "GET",  path: "/account",               phase: "READ_ONLY",        desc: "Balance, Equity, Free Margin, Leverage, Währung" },
  symbol:        { method: "GET",  path: "/symbols/{canonical}",   phase: "READ_ONLY",        desc: "Symbol-Auflösung + Spec (Bid/Ask/Spread/Tick/Contract/Lot)" },
  positions:     { method: "GET",  path: "/positions",             phase: "READ_ONLY",        desc: "Offene Positionen" },
  heartbeat:     { method: "GET",  path: "/ea/heartbeat",          phase: "READ_ONLY",        desc: "EA-Heartbeat, Age, Timeout" },
  validateOrder: { method: "POST", path: "/orders/validate",       phase: "ORDER_VALIDATION", desc: "Entry/SL/TP/Lot gegen Broker-Regeln prüfen – keine Order" },
  executeOrder:  { method: "POST", path: "/orders/execute",        phase: "LIVE_EXECUTE",    desc: "Live-Order – GESPERRT bis Phase 4 + alle Gates grün" },
};

export const executeGateKeys = eaArmGates.map((g) => g.key);

// /orders/execute ist blockiert, wenn:
//   - live_execution_blocked = true
//   - Phase != LIVE_EXECUTE
//   - nicht alle 8 Gates grün sind
export function isExecuteBlocked(conn, gates, phase) {
  if (!conn || isLiveBlocked(conn)) return true;
  if (phase !== "LIVE_EXECUTE") return true;
  return !executeGateKeys.every((k) => gates[k] === true);
}

// Minimale Feld-Prüfung für /orders/validate (Schema-Referenz für das Backend).
export function validateOrderRequest(req) {
  const required = ["signal_id", "canonical", "side", "entry", "stop_loss", "take_profit", "lot"];
  const missing = required.filter((f) => req[f] === undefined || req[f] === null);
  return { ok: missing.length === 0, missing };
}