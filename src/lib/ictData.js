// ICT Market Scanner v2 — Daten, Konstanten, Score-Engine
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI

export const ICT_KILLZONES = [
  { name: "ASIA", label: "Asia Killzone", start: "20:00", end: "00:00", color: "muted" },
  { name: "LONDON", label: "London Killzone", start: "02:00", end: "05:00", color: "primary" },
  { name: "NEW_YORK", label: "New York Killzone", start: "07:00", end: "10:00", color: "accent" },
  { name: "LONDON_CLOSE", label: "London Close", start: "10:00", end: "12:00", color: "warning" },
];

export const ICT_HARD_GATES = [
  { key: "gate_live_data", label: "Live-Daten verfügbar", weight: "blocking" },
  { key: "gate_data_fresh", label: "Daten aktuell (<2s Lag)", weight: "blocking" },
  { key: "gate_liquidity_sweep", label: "Liquidity Sweep bestätigt", weight: "blocking" },
  { key: "gate_displacement", label: "Displacement vorhanden", weight: "blocking" },
  { key: "gate_mss_bos", label: "MSS / BOS bestätigt", weight: "blocking" },
  { key: "gate_fvg_ob_entry", label: "FVG / OB Entry valid", weight: "blocking" },
  { key: "gate_crv_min", label: "CRV ≥ 2.0", weight: "blocking" },
  { key: "gate_news_clear", label: "News-Gate frei", weight: "blocking" },
  { key: "gate_risk_approved", label: "Risk Engine approved", weight: "blocking" },
  { key: "gate_governance_approved", label: "Governance approved", weight: "blocking" },
];

export const ICT_SCORE_WEIGHTS = {
  htf_alignment: 15,
  liquidity_sweep: 20,
  displacement: 15,
  mss_bos: 15,
  fvg_ob: 15,
  premium_discount: 10,
  killzone: 10,
};

export const ICT_SCORE_THRESHOLDS = {
  PAPER_ENTRY: 70,
  ARMED: 50,
};

export const CRV_MINIMUM = 2.0;

// ICT Score Engine — berechnet 0-100 Score aus ICT Komponenten
export function calculateICTScore(signal) {
  let score = 0;

  // HTF Alignment: Side muss mit HTF Structure übereinstimmen
  if (signal.htf_market_structure === signal.side) score += ICT_SCORE_WEIGHTS.htf_alignment;

  // Liquidity Sweep
  if (signal.liquidity_sweep) score += ICT_SCORE_WEIGHTS.liquidity_sweep;

  // Displacement
  if (signal.displacement) score += ICT_SCORE_WEIGHTS.displacement;

  // MSS / BOS
  if (signal.mss_bos !== "NONE") score += ICT_SCORE_WEIGHTS.mss_bos;

  // FVG oder OB
  if (signal.fvg_detected || signal.order_block_detected) score += ICT_SCORE_WEIGHTS.fvg_ob;

  // Premium/Discount: LONG will DISCOUNT, SHORT will PREMIUM
  const sideAligned = signal.side === "LONG" ? signal.premium_discount === "DISCOUNT" : signal.premium_discount === "PREMIUM";
  if (sideAligned) score += ICT_SCORE_WEIGHTS.premium_discount;

  // Killzone: London oder NY
  if (signal.killzone === "LONDON" || signal.killzone === "NEW_YORK") score += ICT_SCORE_WEIGHTS.killzone;

  return Math.min(100, score);
}

// Hard Gates evaluieren — ein einziger FAIL = NO_TRADE (Score kann Gate nicht überstimmen)
export function evaluateHardGates(signal) {
  return {
    gate_live_data: signal.gate_live_data === true,
    gate_data_fresh: signal.gate_data_fresh === true,
    gate_liquidity_sweep: signal.liquidity_sweep === true,
    gate_displacement: signal.displacement === true,
    gate_mss_bos: signal.mss_bos !== "NONE" && signal.mss_bos !== undefined,
    gate_fvg_ob_entry: signal.fvg_detected === true || signal.order_block_detected === true,
    gate_crv_min: (signal.crv || 0) >= CRV_MINIMUM,
    gate_news_clear: signal.gate_news_clear === true,
    gate_risk_approved: signal.gate_risk_approved === true,
    gate_governance_approved: signal.gate_governance_approved === true,
  };
}

// Decision Engine — Hard Gates haben absoluten Vorrang vor Score
export function evaluateDecision(signal) {
  const gates = evaluateHardGates(signal);
  const allGatesPass = Object.values(gates).every((g) => g === true);
  const score = signal.ict_score || 0;

  // Hard Gate FAIL → NO_TRADE, egal wie hoch der Score ist
  if (!allGatesPass) return "NO_TRADE";

  if (score >= ICT_SCORE_THRESHOLDS.PAPER_ENTRY) return "PAPER_ENTRY";
  if (score >= ICT_SCORE_THRESHOLDS.ARMED) return "ARMED";
  return "WATCH_ONLY";
}

export function evaluatePipelineStage(signal) {
  const gates = evaluateHardGates(signal);
  const allGatesPass = Object.values(gates).every((g) => g === true);
  if (!allGatesPass) return "BLOCKED";
  const score = signal.ict_score || 0;
  if (score >= ICT_SCORE_THRESHOLDS.PAPER_ENTRY) return "PAPER_TRADE";
  if (score >= ICT_SCORE_THRESHOLDS.ARMED) return "CONFIRMED";
  return "WATCH";
}

export const DECISION_CONFIG = {
  NO_TRADE: { label: "NO TRADE", color: "loss" },
  WATCH_ONLY: { label: "WATCH ONLY", color: "warning" },
  ARMED: { label: "ARMED", color: "cyan" },
  PAPER_ENTRY: { label: "PAPER ENTRY", color: "profit" },
};

export const PIPELINE_CONFIG = {
  WATCH: { label: "WATCH", color: "muted" },
  ARMED: { label: "ARMED", color: "cyan" },
  CONFIRMED: { label: "CONFIRMED", color: "warning" },
  PAPER_TRADE: { label: "PAPER TRADE", color: "profit" },
  BLOCKED: { label: "BLOCKED", color: "loss" },
  EXPIRED: { label: "EXPIRED", color: "muted" },
};

export const PIPELINE_STEPS = [
  { key: "liquidity_sweep", label: "Liquidity Sweep" },
  { key: "displacement", label: "Displacement" },
  { key: "mss_bos", label: "MSS / BOS" },
  { key: "fvg_ob", label: "FVG / OB Entry" },
];

// Mock-Signale — demonstrieren Hard-Gate-Sperrlogik
// Signal 1: XAUUSD LONG — vollständiges ICT Setup, alle Gates PASS → PAPER_ENTRY
// Signal 2: BTCUSD LONG — Displacement fehlt (Hard Gate FAIL) trotz Score 75 → NO_TRADE
// Signal 3: XAUUSD SHORT — Sweep + Displacement aber kein MSS → NO_TRADE
// Signal 4: BTCUSD SHORT — alle ICT Komponenten aber Daten stale → NO_TRADE
export const mockICTSignals = [
  {
    id: "ict-001",
    symbol: "XAUUSD",
    source: "FOREX",
    side: "LONG",
    timeframe_entry: "M5",
    timeframe_context: "H1",
    htf_market_structure: "BULLISH",
    pdh: 2412.50,
    pdl: 2389.20,
    pwh: 2435.80,
    pwl: 2371.40,
    asia_high: 2401.30,
    asia_low: 2395.10,
    london_high: 2408.90,
    london_low: 2398.50,
    equal_highs: true,
    equal_lows: false,
    liquidity_pool_type: "EQUAL_HIGHS",
    liquidity_sweep: true,
    sweep_direction: "UPWARD_SWEEP",
    displacement: true,
    displacement_candles: 3,
    mss_bos: "MSS",
    mss_direction: "BULLISH",
    fvg_detected: true,
    fvg_top: 2402.80,
    fvg_bottom: 2399.50,
    order_block_detected: true,
    ob_high: 2397.20,
    ob_low: 2394.80,
    premium_discount: "DISCOUNT",
    killzone: "LONDON",
    gate_live_data: true,
    gate_data_fresh: true,
    gate_news_clear: true,
    gate_risk_approved: true,
    gate_governance_approved: true,
    ict_score: 100,
    ascan_score: 82,
    crv: 3.2,
    entry_price: 2400.50,
    stop_loss: 2394.80,
    tp1: 2408.00,
    tp2: 2415.00,
    tp3: 2425.00,
    notes: "A+ ICT Setup: Equal Highs Sweep → Displacement → MSS → FVG in Discount. London Killzone.",
  },
  {
    id: "ict-002",
    symbol: "BTCUSD",
    source: "BINANCE",
    side: "LONG",
    timeframe_entry: "M5",
    timeframe_context: "H4",
    htf_market_structure: "BULLISH",
    pdh: 98500,
    pdl: 96200,
    pwh: 99800,
    pwl: 94500,
    asia_high: 97800,
    asia_low: 97100,
    london_high: 98200,
    london_low: 97500,
    equal_highs: false,
    equal_lows: false,
    liquidity_pool_type: "PDH",
    liquidity_sweep: true,
    sweep_direction: "UPWARD_SWEEP",
    displacement: false,
    displacement_candles: 0,
    mss_bos: "NONE",
    mss_direction: "NEUTRAL",
    fvg_detected: false,
    fvg_top: null,
    fvg_bottom: null,
    order_block_detected: false,
    ob_high: null,
    ob_low: null,
    premium_discount: "EQUILIBRIUM",
    killzone: "NEW_YORK",
    gate_live_data: true,
    gate_data_fresh: true,
    gate_news_clear: true,
    gate_risk_approved: false,
    gate_governance_approved: false,
    ict_score: 35,
    ascan_score: 75,
    crv: 1.4,
    entry_price: null,
    stop_loss: null,
    tp1: null,
    tp2: null,
    tp3: null,
    notes: "Sweep vorhanden aber KEIN Displacement, kein MSS, kein FVG. ASCAN-Score 75 wird durch Hard Gates überstimmt → NO TRADE.",
  },
  {
    id: "ict-003",
    symbol: "XAUUSD",
    source: "FOREX",
    side: "SHORT",
    timeframe_entry: "M5",
    timeframe_context: "H1",
    htf_market_structure: "BEARISH",
    pdh: 2412.50,
    pdl: 2389.20,
    pwh: 2435.80,
    pwl: 2371.40,
    asia_high: 2401.30,
    asia_low: 2395.10,
    london_high: 2408.90,
    london_low: 2398.50,
    equal_highs: false,
    equal_lows: true,
    liquidity_pool_type: "EQUAL_LOWS",
    liquidity_sweep: true,
    sweep_direction: "DOWNWARD_SWEEP",
    displacement: true,
    displacement_candles: 2,
    mss_bos: "NONE",
    mss_direction: "NEUTRAL",
    fvg_detected: false,
    fvg_top: null,
    fvg_bottom: null,
    order_block_detected: true,
    ob_high: 2405.00,
    ob_low: 2402.00,
    premium_discount: "PREMIUM",
    killzone: "NEW_YORK",
    gate_live_data: true,
    gate_data_fresh: true,
    gate_news_clear: true,
    gate_risk_approved: false,
    gate_governance_approved: false,
    ict_score: 70,
    ascan_score: 68,
    crv: 2.8,
    entry_price: null,
    stop_loss: null,
    tp1: null,
    tp2: null,
    tp3: null,
    notes: "Sweep + Displacement + OB aber MSS fehlt. Hard Gate FAIL → NO TRADE. Warten auf MSS-Bestätigung.",
  },
  {
    id: "ict-004",
    symbol: "BTCUSD",
    source: "BINANCE",
    side: "SHORT",
    timeframe_entry: "M5",
    timeframe_context: "H1",
    htf_market_structure: "BEARISH",
    pdh: 98500,
    pdl: 96200,
    pwh: 99800,
    pwl: 94500,
    asia_high: 97800,
    asia_low: 97100,
    london_high: 98200,
    london_low: 97500,
    equal_highs: true,
    equal_lows: false,
    liquidity_pool_type: "EQUAL_HIGHS",
    liquidity_sweep: true,
    sweep_direction: "UPWARD_SWEEP",
    displacement: true,
    displacement_candles: 3,
    mss_bos: "MSS",
    mss_direction: "BEARISH",
    fvg_detected: true,
    fvg_top: 97900,
    fvg_bottom: 97650,
    order_block_detected: true,
    ob_high: 98050,
    ob_low: 97800,
    premium_discount: "PREMIUM",
    killzone: "LONDON",
    gate_live_data: true,
    gate_data_fresh: false,
    gate_news_clear: true,
    gate_risk_approved: false,
    gate_governance_approved: false,
    ict_score: 100,
    ascan_score: 88,
    crv: 3.5,
    entry_price: 97720,
    stop_loss: 98100,
    tp1: 97000,
    tp2: 96400,
    tp3: 95500,
    notes: "Vollständiges ICT Setup aber Daten stale (Lag >5s). Hard Gate gate_data_fresh FAIL → NO TRADE. Score 100 wird überstimmt.",
  },
];

// Live-Feed Status (Mock — echter Feed ist P1-Blocker)
export const feedStatus = {
  connected: false,
  mode: "MOCK",
  lag_ms: 0,
  symbols_watched: ["XAUUSD", "BTCUSD"],
  block_reason: "Live-Feed nicht integriert (P1-Blocker aus Go-Live-Test). Scanner läuft mit Mock-Daten.",
};

// Killzone-Berechnung (UTC-basiert, vereinfacht)
export function getCurrentKillzone() {
  const hour = new Date().getUTCHours();
  if (hour >= 20 || hour < 0) return ICT_KILLZONES[0];
  if (hour >= 2 && hour < 5) return ICT_KILLZONES[1];
  if (hour >= 7 && hour < 10) return ICT_KILLZONES[2];
  if (hour >= 10 && hour < 12) return ICT_KILLZONES[3];
  return { name: "OFF", label: "Außerhalb Killzone", color: "muted" };
}