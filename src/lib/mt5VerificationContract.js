// QuantPilot MT5 – Zentraler Verification Contract (Single Source of Truth)
//
// Aus dieser Definition leiten UI, API-Vertrag, Probe und Dokumentation dieselben
// Check-Namen, dieselbe Check-Anzahl und denselben Status ab.
//
// Kanonische Check-Anzahl: 14 (identisch zu quantpilot-mt5-bridge/e2e_probe.py).
// Es darf KEINE zweite abweichende Check-Liste (10, 12, etc.) im Repository geben.
//
// WICHTIG: MT5_E2E_CONNECTED darf ausschließlich gesetzt werden, wenn die aktuelle
// reale Probe (e2e_probe.py auf dem Windows/MT5-Host) alle 14 Checks bestätigt.
// Ein persistierter Frontend-Datensatz ist KEIN E2E-Beweis.

// ─── Verification Tiers (3-Stufen-Modell) ──────────────────────────────────
export const VERIFICATION_TIERS = {
  UI_CONTRACT: {
    key: "UI_CONTRACT",
    label: "UI_CONTRACT",
    color: "loss",
    desc: "Nur Vertrag/UI. Keine Bridge, kein Terminal angebunden.",
  },
  BACKEND_CONNECTED: {
    key: "BACKEND_CONNECTED",
    label: "BACKEND_CONNECTED",
    color: "warning",
    desc: "FastAPI erreichbar, aber MT5-Terminal nicht bewiesen.",
  },
  MT5_E2E_CONNECTED: {
    key: "MT5_E2E_CONNECTED",
    label: "MT5_E2E_CONNECTED",
    color: "profit",
    desc: "FastAPI → MT5 → Vantage bewiesen (alle 14 Checks PASS).",
  },
};

// Probe-Verdict (kein Tier, sondern Ergebnis des Probe-Laufs)
export const PROBE_VERDICT = {
  MT5_E2E_CONNECTED: "MT5_E2E_CONNECTED",
  MT5_E2E_NOT_VERIFIED: "MT5_E2E_NOT_VERIFIED",
};

// ─── E2E Checks (14 – kanonisch, identisch zu e2e_probe.py) ────────────────
// status: pending | pass | fail – default pending. Echte Werte liefert nur
// der Probe-Lauf auf dem Windows/MT5-Rechner. Keine Default-PASS-Werte.
export const E2E_CHECKS = [
  { key: "bridge_health",        label: "[01] Bridge Health",            mt5_call: null,                          status: "pending" },
  { key: "mt5_initialize",       label: "[02] MT5 Initialize",           mt5_call: "mt5.initialize()",            status: "pending" },
  { key: "terminal_info",        label: "[03] Terminal erreichbar",      mt5_call: "mt5.terminal_info()",         status: "pending" },
  { key: "account_info",         label: "[04] Account erkannt",          mt5_call: "mt5.account_info()",          status: "pending" },
  { key: "server_verify",        label: "[05] Server erkannt",           mt5_call: "account_info.server",         status: "pending" },
  { key: "balance",              label: "[06] Balance",                  mt5_call: "account_info.balance",        status: "pending" },
  { key: "equity",               label: "[07] Equity",                   mt5_call: "account_info.equity",         status: "pending" },
  { key: "free_margin",          label: "[08] Free Margin",             mt5_call: "account_info.margin_free",    status: "pending" },
  { key: "symbol_discovery",     label: "[09] XAUUSD Symbol Discovery",  mt5_call: "mt5.symbol_info()",           status: "pending" },
  { key: "symbol_tick",          label: "[10] Tick",                     mt5_call: "mt5.symbol_info_tick()",      status: "pending" },
  { key: "positions_get",        label: "[11] Positions",               mt5_call: "mt5.positions_get()",          status: "pending" },
  { key: "orders_get",           label: "[12] Orders",                    mt5_call: "mt5.orders_get()",            status: "pending" },
  { key: "heartbeat",            label: "[13] Heartbeat",                mt5_call: "POST /heartbeat",             status: "pending" },
  { key: "order_check",          label: "[14] order_check",              mt5_call: "mt5.order_check()",           status: "pending" },
];

export const E2E_CHECK_COUNT = E2E_CHECKS.length; // 14 – kanonisch

// ─── Heartbeat States ─────────────────────────────────────────────────────
export const HEARTBEAT_STATES = {
  HEALTHY: { key: "HEALTHY",  threshold: "< 10s",  desc: "EA Heartbeat stabil" },
  WARNING: { key: "WARNING", threshold: "10–30s", desc: "Heartbeat verzögert" },
  STALE:   { key: "STALE",   threshold: "> 30s",  desc: "Heartbeat verloren → EXECUTION BLOCKED" },
};

// ─── Login States ──────────────────────────────────────────────────────────
export const LOGIN_STATES = {
  LOGGED_OUT:  "LOGGED_OUT",
  LOGGED_IN:   "LOGGED_IN",
  AUTH_FAILED: "AUTH_FAILED",
};

// ─── EA States ─────────────────────────────────────────────────────────────
export const EA_STATES = {
  NOT_INSTALLED:    "NOT_INSTALLED",
  OFFLINE:          "OFFLINE",
  CONNECTED:        "CONNECTED",
  HEARTBEAT_LOST:   "HEARTBEAT_LOST",
  BLOCKED:          "BLOCKED",
  ARMED:            "ARMED",
};

// ─── Execution Guard ──────────────────────────────────────────────────────
// order_send() darf NIEMALS ausgeführt werden, bis Phase D + alle Gates grün.
// order_check() ist eine Pre-Trade-Validierung – KEIN ausgeführter Trade.
export const EXECUTION_GUARD = {
  ORDER_SEND: "BLOCKED",          // mt5.order_send() – technisch blockiert
  ORDER_CHECK: "VALIDATION_ONLY", // mt5.order_check() – keine Order, nur Prüfung
  LIVE_EXECUTION: "BLOCKED",       // /orders/execute – Kill-Switch aktiv
};

// ─── Tier-Regel ───────────────────────────────────────────────────────────
// MT5_E2E_CONNECTED darf ausschließlich aus echter Probe-Evidenz entstehen.
export function deriveTierFromProbe(probeResults) {
  if (!probeResults || !Array.isArray(probeResults)) return VERIFICATION_TIERS.UI_CONTRACT.key;
  const allPass = probeResults.length === E2E_CHECK_COUNT &&
    probeResults.every((r) => r.status === "pass");
  if (!allPass) return PROBE_VERDICT.MT5_E2E_NOT_VERIFIED;
  // Bridge muss mindestens antworten (Check 01), sonst nicht mal BACKEND_CONNECTED
  const bridgeOk = probeResults.some((r) => r.key === "bridge_health" && r.status === "pass");
  if (!bridgeOk) return VERIFICATION_TIERS.UI_CONTRACT.key;
  return VERIFICATION_TIERS.MT5_E2E_CONNECTED.key;
}

export function deriveTierFromBridgeReachable(bridgeReachable) {
  return bridgeReachable ? VERIFICATION_TIERS.BACKEND_CONNECTED.key : VERIFICATION_TIERS.UI_CONTRACT.key;
}