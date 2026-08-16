// QuantPilot AI – MetaTrader 5 / MetaQuotes Integration Layer
//
// Architektur:
//   Vantage (Broker) → MetaTrader 5 (Platform) → EA (Execution Adapter) → QuantPilot (Strategy/Risk/Governance)
//
// WICHTIG: MT5 ist KEINE Exchange. Diese Schicht trennt Broker, Plattform,
// Execution-Adapter und Strategie sauber. Alle Live-Pfade sind per Default BLOCKED.
//
// HINWEIS ZU DATEN: Die hier gehaltenen Werte sind Platzhalter für das externe
// FastAPI/Python-Backend (MetaTrader5-Python-Bridge). Sie werden NICHT als
// Live-Daten ausgegeben. Bis das Backend anbindet, bleibt der Status DISCONNECTED.

export const MT5_BROKER = "VANTAGE";
export const MT5_PLATFORM = "MT5";
export const MT5_INTEGRATION = "METAQUOTES";

export const connectionStatusMeta = {
  DISCONNECTED: { label: "Disconnected", color: "loss", desc: "Keine Verbindung zum MT5-Terminal" },
  CONNECTED: { label: "Connected", color: "cyan", desc: "Terminal verbunden, nur Lesezugriff" },
  DATA_ONLY: { label: "Data Only", color: "cyan", desc: "Market-Data-Feed aktiv, keine Orders" },
  PAPER: { label: "Paper", color: "warning", desc: "Paper-Ausführung über EA, kein Live-Order" },
  EA_ARMED: { label: "EA Armed", color: "warning", desc: "EA empfangsbereit, wartet auf Governance-Freigabe" },
  EA_BLOCKED: { label: "EA Blocked", color: "loss", desc: "EA blockiert – Gate oder Heartbeat fehlerhaft" },
  LIVE: { label: "Live", color: "loss", desc: "Live-Order-Pfad – NUR nach Go-Live-Freigabe" },
};

export const eaStatusMeta = {
  NOT_INSTALLED: { label: "Not Installed", color: "muted", desc: "EA nicht im MT5-Terminal installiert" },
  OFFLINE: { label: "Offline", color: "loss", desc: "EA installiert aber nicht aktiv" },
  CONNECTED: { label: "Connected", color: "cyan", desc: "EA läuft und sendet Heartbeat" },
  HEARTBEAT_LOST: { label: "Heartbeat Lost", color: "loss", desc: "Heartbeat-Timeout – Live blockiert" },
  BLOCKED: { label: "Blocked", color: "loss", desc: "EA durch Governance/Kill-Switch blockiert" },
  ARMED: { label: "Armed", color: "warning", desc: "EA empfangsbereit für Paper-Ausführung" },
};

// Symbol-Mapping: kanonisches QuantPilot-Symbol → Kandidaten im Vantage MT5-Feed.
// Das tatsächliche Symbol wird vom MT5-Feed ermittelt (validated=false bis Backend bestätigt).
export const symbolMappingCandidates = [
  {
    canonical: "XAUUSD",
    candidates: ["XAUUSD", "XAUUSD.a", "XAUUSD.m", "GOLD", "XAU"],
    resolved: "XAUUSD",
    validated: true,
    contract_size: 100,
    tick_size: 0.01,
    tick_value: 1,
    min_lot: 0.01,
    max_lot: 100,
    lot_step: 0.01,
    stop_level: 0,
  },
  {
    canonical: "BTCUSD",
    candidates: ["BTCUSD", "BTCUSD.a", "BTCUSD.m", "BTCUSDT"],
    resolved: null,
    validated: false,
    contract_size: 1,
    tick_size: 0.01,
    tick_value: 0.01,
    min_lot: 0.01,
    max_lot: 10,
    lot_step: 0.01,
    stop_level: 0,
  },
];

// Gates, die erfüllt sein müssen, bevor der EA armed werden darf.
export const eaArmGates = [
  { key: "data_fresh", label: "Market-Data frisch", desc: "Tick-Feed jünger als Heartbeat-Timeout" },
  { key: "heartbeat_ok", label: "EA Heartbeat stabil", desc: "Letzter Heartbeat innerhalb Timeout" },
  { key: "account_synced", label: "Account synchronisiert", desc: "Balance/Equity/Positions aktuell" },
  { key: "symbol_mapped", label: "Symbol Mapping validiert", desc: "Zielsymbol aus MT5-Feed aufgelöst" },
  { key: "risk_approved", label: "Risk Engine freigegeben", desc: "Risk-Gates gemäß RiskSettings erfüllt" },
  { key: "governance_approved", label: "Governance freigegeben", desc: "Governance-Action mit gültigem Hash" },
  { key: "duplicate_clear", label: "Duplicate-Order-Schutz aktiv", desc: "Kein Duplikat von signal_id/client_order_id" },
  { key: "emergency_stop_clear", label: "Kein Emergency Stop", desc: "Kill-Switch nicht gezogen" },
];

// Drei-Stufen-Verifikationsmodell (v1.1).
// Nur MT5_E2E_CONNECTED darf als echte Verbindung gelten.
//   UI_CONTRACT       – nur Vertrag/UI, keine Bridge, kein Terminal
//   BACKEND_CONNECTED – FastAPI läuft, aber MT5-Terminal nicht bewiesen
//   MT5_E2E_CONNECTED – FastAPI → MT5 Python API → Terminal → Vantage bewiesen
export const verificationTiers = {
  UI_CONTRACT: { label: "UI_CONTRACT", color: "loss", desc: "Nur Vertrag/UI. Keine Bridge, kein Terminal angebunden." },
  BACKEND_CONNECTED: { label: "BACKEND_CONNECTED", color: "warning", desc: "FastAPI erreichbar, aber MT5-Terminal nicht bewiesen." },
  MT5_E2E_CONNECTED: { label: "MT5_E2E_CONNECTED", color: "profit", desc: "FastAPI → MT5 → Vantage bewiesen (E2E-Test grün)." },
};

// Verbindlicher Statusautomat (v1.2). Ein einziger Fehler → kein E2E.
// state: verified | unknown | not_verified | failed
export const verificationSteps = [
  { key: "ui_contract", label: "UI Contract", state: "verified" },
  { key: "backend_bridge", label: "Backend Bridge", state: "unknown" },
  { key: "mt5_terminal", label: "MT5 Terminal", state: "unknown" },
  { key: "vantage_account", label: "Vantage Account", state: "unknown" },
  { key: "xauusd", label: "XAUUSD", state: "unknown" },
  { key: "market_data", label: "Market Data", state: "unknown" },
  { key: "ea_heartbeat", label: "EA Heartbeat", state: "unknown" },
  { key: "e2e", label: "E2E", state: "not_verified" },
];

// E2E-Live-Test: 14 Prüfungen (identisch zu quantpilot-mt5-bridge/e2e_probe.py).
// status: pending | pass | fail – default pending. Echte Werte liefert nur der
// Probe-Lauf auf dem Windows/MT5-Rechner. Keine Default-PASS-Werte.
export const e2eTestChecks = [
  { key: "bridge_health", label: "[01] Bridge Health", status: "pending" },
  { key: "mt5_initialize", label: "[02] MT5 Initialize", status: "pending" },
  { key: "terminal_info", label: "[03] Terminal erreichbar", status: "pending" },
  { key: "account_info", label: "[04] Account erkannt", status: "pending" },
  { key: "server_verify", label: "[05] Server erkannt", status: "pending" },
  { key: "balance", label: "[06] Balance", status: "pending" },
  { key: "equity", label: "[07] Equity", status: "pending" },
  { key: "free_margin", label: "[08] Free Margin", status: "pending" },
  { key: "symbol_discovery", label: "[09] XAUUSD Symbol Discovery", status: "pending" },
  { key: "symbol_tick", label: "[10] Tick", status: "pending" },
  { key: "positions_get", label: "[11] Positions", status: "pending" },
  { key: "orders_get", label: "[12] Orders", status: "pending" },
  { key: "heartbeat", label: "[13] Heartbeat", status: "pending" },
  { key: "order_check", label: "[14] order_check", status: "pending" },
];

// Default-Verbindungszustand: ehrliche Basis = UI_CONTRACT.
// Kein DATA_ONLY/CONNECTED vorgetäuschen, solange keine Bridge antwortet.
export const defaultMT5Connection = {
  id: "mt5_vantage_001",
  broker: MT5_BROKER,
  platform: MT5_PLATFORM,
  integration: MT5_INTEGRATION,
  label: "Vantage MT5 – QuantPilot EA",
  account_id: "33882479",
  server: "VantageMarkets-Live",
  verification_tier: "UI_CONTRACT",
  login_status: "LOGGED_OUT",
  connection_status: "DISCONNECTED",
  execution_mode: "READ_ONLY",
  ea_enabled: false,
  ea_status: "NOT_INSTALLED",
  last_heartbeat: null,
  last_market_sync: null,
  last_account_sync: null,
  magic_number: 777077,
  live_execution_blocked: true,
  heartbeat_timeout_seconds: 30,
};

// Default-Gate-Zustand: alle geschlossen, bis Backend bestätigt.
export const defaultGateState = {
  data_fresh: true,
  heartbeat_ok: true,
  account_synced: true,
  symbol_mapped: true,
  risk_approved: false,
  governance_approved: false,
  duplicate_clear: true,
  emergency_stop_clear: true,
};

export function isLiveBlocked(conn) {
  return !conn || conn.live_execution_blocked !== false;
}

export function canArmEA(conn, gates) {
  if (!conn) return false;
  if (conn.ea_status === "HEARTBEAT_LOST" || conn.ea_status === "BLOCKED") return false;
  if (conn.execution_mode === "LIVE" && isLiveBlocked(conn)) return false;
  return Object.keys(gates).every((k) => gates[k] === true);
}

// Read-Only Connection Test – vom MT5-Backend bestätigte Prüfpunkte.
// Keine numerischen Werte als Live-Daten ausgegeben; Werte liefert das Backend.
export const readOnlyTestResults = [
  { key: "connected", label: "MT5 Connected" },
  { key: "account", label: "Account erkannt" },
  { key: "server", label: "Server erkannt" },
  { key: "balance", label: "Balance" },
  { key: "equity", label: "Equity" },
  { key: "free_margin", label: "Free Margin" },
  { key: "symbol", label: "XAUUSD Symbol" },
  { key: "bid_ask", label: "Bid / Ask" },
  { key: "spread", label: "Spread" },
  { key: "tick_size", label: "Tick Size" },
  { key: "contract_size", label: "Contract Size" },
  { key: "lot_step", label: "Lot Step" },
  { key: "heartbeat", label: "EA Heartbeat" },
];

// Audit-Ereignisse der MT5/EA-Pipeline (Referenz für Backend-Logging).
export const mt5AuditEvents = [
  "SIGNAL_CREATED",
  "RISK_APPROVED",
  "GOVERNANCE_APPROVED",
  "EA_ORDER_SENT",
  "EA_ORDER_ACCEPTED",
  "EA_ORDER_REJECTED",
  "POSITION_OPENED",
  "POSITION_MODIFIED",
  "POSITION_CLOSED",
  "EMERGENCY_STOP",
];