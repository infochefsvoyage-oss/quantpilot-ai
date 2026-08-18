// QuantPilot – ICT Engine (Read-Only / Paper-Shadow)
// Läuft auf REALEN MT5-Candles (M1/M5/M15). Berechnet Market Structure, Liquidity,
// Fair Value Gap, Order Block, Premium/Discount, Session Context und bewertet das Setup.
// Erzeugt NIEMALS eine Live-Order. Output: ICT_SETUP = VALID | WATCH_ONLY | NO_TRADE.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

// ─── Session Context (UTC) ──────────────────────────────────────────────────
export const ICT_SESSIONS = [
  { name: "ASIA", label: "Asia", start: 20, end: 0 },
  { name: "LONDON", label: "London", start: 2, end: 5 },
  { name: "NEW_YORK", label: "New York", start: 7, end: 10 },
  { name: "LONDON_CLOSE", label: "London Close", start: 10, end: 12 },
];

export function getCurrentSession(date = new Date()) {
  const h = date.getUTCHours();
  for (const s of ICT_SESSIONS) {
    if (s.start < s.end) {
      if (h >= s.start && h < s.end) return s;
    } else {
      if (h >= s.start || h < s.end) return s;
    }
  }
  return { name: "OFF", label: "Außerhalb Session" };
}

// ─── Swings / Market Structure ────────────────────────────────────────────────
// Fractal-based swing detection: a high is a swing high if higher than `lookback` candles on each side.
export function detectSwings(candles, lookback = 2) {
  const swings = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, time: c.time, price: c.high, type: "HIGH" });
    if (isLow) swings.push({ index: i, time: c.time, price: c.low, type: "LOW" });
  }
  return swings;
}

export function classifyMarketStructure(swings) {
  const structure = [];
  let lastHigh = null, lastLow = null;
  let trend = "NEUTRAL"; // BULLISH | BEARISH | NEUTRAL
  for (const s of swings) {
    if (s.type === "HIGH") {
      if (lastHigh) {
        if (s.price > lastHigh.price) structure.push({ time: s.time, type: "HH", price: s.price });
        else structure.push({ time: s.time, type: "LH", price: s.price });
      }
      lastHigh = s;
    } else {
      if (lastLow) {
        if (s.price < lastLow.price) structure.push({ time: s.time, type: "LL", price: s.price });
        else structure.push({ time: s.time, type: "HL", price: s.price });
      }
      lastLow = s;
    }
  }
  // BOS/CHOCH: price closes beyond the last swing high/low
  return structure;
}

export function detectBOSCHOCH(candles, swings) {
  if (swings.length < 2) return { mss_bos: "NONE", direction: "NEUTRAL" };
  const lastHigh = [...swings].reverse().find(s => s.type === "HIGH");
  const lastLow = [...swings].reverse().find(s => s.type === "LOW");
  if (!lastHigh || !lastLow) return { mss_bos: "NONE", direction: "NEUTRAL" };
  const recent = candles.slice(lastHigh.index + 1);
  const brokeHigh = recent.some(c => c.close > lastHigh.price);
  const brokeLow = recent.some(c => c.close < lastLow.price);
  if (brokeHigh) return { mss_bos: "BOS", direction: "BULLISH", level: lastHigh.price };
  if (brokeLow) return { mss_bos: "BOS", direction: "BEARISH", level: lastLow.price };
  return { mss_bos: "NONE", direction: "NEUTRAL" };
}

// ─── Liquidity ────────────────────────────────────────────────────────────────
export function detectLiquiditySweep(candles, swings, lookback = 10) {
  const recent = candles.slice(-lookback);
  if (recent.length < 3 || swings.length < 1) return { sweep: false, direction: "NONE", pool: "NONE" };
  const swingHighs = swings.filter(s => s.type === "HIGH").slice(-3);
  const swingLows = swings.filter(s => s.type === "LOW").slice(-3);
  const maxHigh = Math.max(...swingHighs.map(s => s.price));
  const minLow = Math.min(...swingLows.map(s => s.price));
  // Sweep = wick takes the level but close returns back
  for (const c of recent) {
    if (c.high > maxHigh && c.close < maxHigh) return { sweep: true, direction: "UPWARD_SWEEP", pool: "EQUAL_HIGHS", level: maxHigh };
    if (c.low < minLow && c.close > minLow) return { sweep: true, direction: "DOWNWARD_SWEEP", pool: "EQUAL_LOWS", level: minLow };
  }
  return { sweep: false, direction: "NONE", pool: "NONE" };
}

// ─── Fair Value Gap ───────────────────────────────────────────────────────────
export function detectFVG(candles, lookback = 30) {
  const recent = candles.slice(-lookback);
  for (let i = 2; i < recent.length; i++) {
    const c1 = recent[i - 2], c3 = recent[i];
    // Bullish FVG: gap between c1.high and c3.low
    if (c3.low > c1.high) {
      return { detected: true, type: "BULLISH", top: c3.low, bottom: c1.high, size: c3.low - c1.high, index: i };
    }
    // Bearish FVG: gap between c1.low and c3.high
    if (c3.high < c1.low) {
      return { detected: true, type: "BEARISH", top: c1.low, bottom: c3.high, size: c1.low - c3.high, index: i };
    }
  }
  return { detected: false, type: null, top: null, bottom: null, size: 0 };
}

// ─── Order Block ───────────────────────────────────────────────────────────────
export function detectOrderBlock(candles, lookback = 20) {
  const recent = candles.slice(-lookback);
  for (let i = recent.length - 2; i >= 1; i--) {
    const c = recent[i], next = recent[i + 1];
    // Bullish OB: down candle followed by strong up move (displacement)
    if (c.close < c.open && next.close > next.open && (next.close - next.open) > Math.abs(c.open - c.close)) {
      return { detected: true, type: "BULLISH", high: c.high, low: c.low, valid: true };
    }
    // Bearish OB: up candle followed by strong down move
    if (c.close > c.open && next.close < next.open && (next.open - next.close) > Math.abs(c.open - c.close)) {
      return { detected: true, type: "BEARISH", high: c.high, low: c.low, valid: true };
    }
  }
  return { detected: false, type: null, high: null, low: null, valid: false };
}

// ─── Premium / Discount ────────────────────────────────────────────────────────
export function computePremiumDiscount(candles, lookback = 50) {
  const recent = candles.slice(-lookback);
  if (recent.length < 5) return { zone: "EQUILIBRIUM", high: null, low: null, equilibrium: null };
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const equilibrium = (high + low) / 2;
  const price = recent[recent.length - 1].close;
  let zone = "EQUILIBRIUM";
  if (price > equilibrium + (high - low) * 0.1) zone = "PREMIUM";
  else if (price < equilibrium - (high - low) * 0.1) zone = "DISCOUNT";
  return { zone, high, low, equilibrium };
}

// ─── ICT Setup Engine ─────────────────────────────────────────────────────────
// VALID nur wenn: Liquidity Sweep + Displacement (BOS) + FVG/OB + Side-Alignment.
// RR nur im erlaubten Bereich 1:1.8 bis 1:4. Keine Live-Order.
export function evaluateICTSetup(components) {
  const { sweep, bos, fvg, ob, premiumDiscount, session, side } = components;
  const hasSweep = sweep && sweep.sweep;
  const hasDisplacement = bos && bos.mss_bos !== "NONE";
  const hasFVGorOB = (fvg && fvg.detected) || (ob && ob.detected);
  const sideAligned = side === "LONG"
    ? (bos && bos.direction === "BULLISH") && premiumDiscount.zone === "DISCOUNT"
    : (bos && bos.direction === "BEARISH") && premiumDiscount.zone === "PREMIUM";
  const inKillzone = session && (session.name === "LONDON" || session.name === "NEW_YORK");

  if (hasSweep && hasDisplacement && hasFVGorOB && sideAligned && inKillzone) return "VALID";
  if (hasSweep || hasDisplacement || hasFVGorOB) return "WATCH_ONLY";
  return "NO_TRADE";
}

// Refined decision states for PHASE ICT-XAUUSD-RO:
// NO_TRADE → WATCH → SETUP → VALIDATED_SETUP
export function evaluateDecisionState(components) {
  const { sweep, bos, fvg, ob, premiumDiscount, session, side } = components;
  const hasSweep = sweep && sweep.sweep;
  const hasDisplacement = bos && bos.mss_bos !== "NONE";
  const hasFVGorOB = (fvg && fvg.detected) || (ob && ob.detected);
  const sideAligned = side === "LONG"
    ? (bos && bos.direction === "BULLISH") && premiumDiscount.zone === "DISCOUNT"
    : (bos && bos.direction === "BEARISH") && premiumDiscount.zone === "PREMIUM";
  const inKillzone = session && (session.name === "LONDON" || session.name === "NEW_YORK");

  if (hasSweep && hasDisplacement && hasFVGorOB && sideAligned && inKillzone) return "VALIDATED_SETUP";
  if (hasSweep && hasDisplacement && hasFVGorOB) return "SETUP";
  if (hasSweep || hasDisplacement || hasFVGorOB) return "WATCH";
  return "NO_TRADE";
}

// Structure version — hash of recent swing points to detect structure changes
export function computeStructureVersion(swings) {
  const recent = swings.slice(-5);
  return recent.map(s => `${s.type}:${Math.round(s.price * 100)}`).join("|");
}

// Signal freshness — a signal is STALE if signal_age_ms exceeds threshold
export const SIGNAL_FRESHNESS_THRESHOLD_MS = 5000;

export function checkSignalFreshness(signalCreatedAt, marketDataTimestamp, structureVersion, previousStructureVersion) {
  const now = Date.now();
  const signalAgeMs = now - signalCreatedAt;
  const signalFresh = signalAgeMs <= SIGNAL_FRESHNESS_THRESHOLD_MS;
  const structureChanged = previousStructureVersion != null && structureVersion !== previousStructureVersion;
  return {
    signal_created_at: signalCreatedAt,
    market_data_timestamp: marketDataTimestamp,
    signal_age_ms: signalAgeMs,
    signal_fresh: signalFresh,
    structure_version: structureVersion,
    structure_changed: structureChanged,
    signal_status: signalFresh ? "FRESH" : "STALE",
    execution: signalFresh ? "ALLOWED_ANALYSIS" : "BLOCKED",
  };
}

export function computeRR(entry, stopLoss, takeProfit) {
  if (!entry || !stopLoss || !takeProfit) return 0;
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk === 0) return 0;
  return reward / risk;
}

export function rrInAllowedRange(rr) {
  return rr >= 1.8 && rr <= 4.0;
}

// ─── Full ICT Analysis ────────────────────────────────────────────────────────
export function analyzeICT(candles, side = "LONG") {
  if (!candles || candles.length < 10) {
    return {
      valid: false, setup: "NO_TRADE", decision: "NO_TRADE",
      reason: "insufficient_candles", components: null,
      latencies: {}, signal_freshness: null,
    };
  }

  const lat = {};

  // M1 STRUCTURE
  const t0 = performance.now();
  const swings = detectSwings(candles);
  const structure = classifyMarketStructure(swings);
  const bos = detectBOSCHOCH(candles, swings);
  lat.structure_ms = performance.now() - t0;

  // LIQUIDITY / SWEEP / RAID
  const t1 = performance.now();
  const sweep = detectLiquiditySweep(candles, swings);
  lat.liquidity_ms = performance.now() - t1;

  // FVG / ORDER BLOCK
  const t2 = performance.now();
  const fvg = detectFVG(candles);
  const ob = detectOrderBlock(candles);
  lat.fvg_ob_ms = performance.now() - t2;

  // PREMIUM / DISCOUNT + KILLZONE
  const t3 = performance.now();
  const premiumDiscount = computePremiumDiscount(candles);
  const session = getCurrentSession();
  lat.premium_discount_ms = performance.now() - t3;

  // ICT SCORE + SIGNAL
  const t4 = performance.now();
  const components = { swings, structure, bos, sweep, fvg, ob, premiumDiscount, session, side };
  const setup = evaluateICTSetup(components);
  const decision = evaluateDecisionState(components);
  lat.signal_ms = performance.now() - t4;

  lat.total_ms = lat.structure_ms + lat.liquidity_ms + lat.fvg_ob_ms + lat.premium_discount_ms + lat.signal_ms;

  // Signal freshness
  const lastCandleTime = candles[candles.length - 1].time * 1000;
  const signalCreatedAt = Date.now();
  const structureVersion = computeStructureVersion(swings);

  return {
    valid: setup === "VALID",
    setup,
    decision,
    components,
    latencies: lat,
    signal_freshness: {
      signal_created_at: signalCreatedAt,
      market_data_timestamp: lastCandleTime,
      structure_version: structureVersion,
    },
  };
}

// ─── Paper Signal Generator ───────────────────────────────────────────────────
export function generatePaperSignal(analysis, tick, timeframe = "M1") {
  if (!analysis || !analysis.valid) return null;
  const { components } = analysis;
  const { sweep, ob, fvg, premiumDiscount, session } = components;
  const entry = tick && tick.bid ? tick.bid : null;
  const direction = components.side;
  if (!entry) return null;
  // ── SL-Richtungslogik (PHASE SL-FIX) ──────────────────────────────────
  // SL muss zwingend auf der korrekten Seite des Entry liegen:
  //   LONG  → SL < ENTRY  (unter Entry)
  //   SHORT → SL > ENTRY  (über Entry)
  // OB-Typ muss zur Richtung passen (BULLISH OB für LONG, BEARISH OB für SHORT).
  // Fallback auf Sweep-Level, falls dieser auf der korrekten Seite liegt.
  let stopLoss = null;
  if (direction === "LONG") {
    if (ob && ob.type === "BULLISH" && ob.low != null && ob.low < entry) stopLoss = ob.low;
    else if (sweep && sweep.level != null && sweep.level < entry) stopLoss = sweep.level;
  } else {
    if (ob && ob.type === "BEARISH" && ob.high != null && ob.high > entry) stopLoss = ob.high;
    else if (sweep && sweep.level != null && sweep.level > entry) stopLoss = sweep.level;
  }
  if (!stopLoss) return null;
  // ── Geometrie-Validierung (zwingend VOR Risk/RR) ──────────────────────
  const slGeometryValid = direction === "LONG" ? stopLoss < entry : stopLoss > entry;
  if (!slGeometryValid) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return null;
  const tp1 = direction === "LONG" ? entry + risk * 2 : entry - risk * 2;
  const tp2 = direction === "LONG" ? entry + risk * 3 : entry - risk * 3;
  const rr = computeRR(entry, stopLoss, tp1);
  if (!rrInAllowedRange(rr)) return null;
  return {
    symbol: "XAUUSD",
    timeframe,
    direction,
    setup: "ICT_LIQUIDITY_SWEEP_FVG_OB",
    decision: analysis.decision || (analysis.valid ? "VALIDATED_SETUP" : "WATCH"),
    entry,
    stop_loss: stopLoss,
    tp1,
    tp2,
    rr: Math.round(rr * 100) / 100,
    liquidity_target: sweep ? sweep.level : null,
    structure: components.bos ? `${components.bos.mss_bos}_${components.bos.direction}` : "NONE",
    confidence: analysis.valid ? "VALID" : "WATCH_ONLY",
    session: session ? session.name : "OFF",
    timestamp: new Date().toISOString(),
    mode: "PAPER",
    signal_created_at: analysis.signal_freshness?.signal_created_at || Date.now(),
    market_data_timestamp: analysis.signal_freshness?.market_data_timestamp || null,
    structure_version: analysis.signal_freshness?.structure_version || null,
  };
}