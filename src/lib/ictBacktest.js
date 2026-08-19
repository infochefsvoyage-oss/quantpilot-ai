// QuantPilot – A+ Setup Backtest Engine (Shadow / Read-Only)
// Slides a window over historical M1 candles, evaluates ICT setups at each
// candle close, classifies A+ (VALIDATED_SETUP + SL-geometry + RR 1.8-4.0),
// and simulates paper-trade outcomes (TP1 hit before SL).
//
// Uses the SAME ICT logic as ictEngine.js but with historical session detection
// (candle timestamp instead of current time). No live orders, no simulation
// of fake data — only real MT5 candles.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import {
  detectSwings,
  detectBOSCHOCH,
  detectLiquiditySweep,
  detectFVG,
  detectOrderBlock,
  computePremiumDiscount,
  computeRR,
  rrInAllowedRange,
  ICT_SESSIONS,
} from "@/lib/ictEngine";

// ─── Session detection at a specific timestamp (UTC) ──────────────────────
function getSessionAtTime(timestampMs) {
  const h = new Date(timestampMs).getUTCHours();
  for (const s of ICT_SESSIONS) {
    if (s.start < s.end) {
      if (h >= s.start && h < s.end) return s;
    } else {
      if (h >= s.start || h < s.end) return s;
    }
  }
  return { name: "OFF", label: "Außerhalb Session" };
}

// ─── Evaluate ICT setup at a specific candle (historical) ──────────────────
// Replicates evaluateDecisionState logic but with session from candle time.
function evaluateAtCandle(window, side) {
  const swings = detectSwings(window);
  const bos = detectBOSCHOCH(window, swings);
  const sweep = detectLiquiditySweep(window, swings);
  const fvg = detectFVG(window);
  const ob = detectOrderBlock(window);
  const premiumDiscount = computePremiumDiscount(window);
  const lastCandle = window[window.length - 1];
  const session = getSessionAtTime(lastCandle.time * 1000);

  const hasSweep = !!(sweep && sweep.sweep);
  const hasDisplacement = !!(bos && bos.mss_bos !== "NONE");
  const hasFVGorOB = !!((fvg && fvg.detected) || (ob && ob.detected));
  const sideAligned = side === "LONG"
    ? !!(bos && bos.direction === "BULLISH" && premiumDiscount.zone === "DISCOUNT")
    : !!(bos && bos.direction === "BEARISH" && premiumDiscount.zone === "PREMIUM");
  const inKillzone = !!(session && (session.name === "LONDON" || session.name === "NEW_YORK"));

  const validatedSetup = hasSweep && hasDisplacement && hasFVGorOB && sideAligned && inKillzone;

  return { validatedSetup, swings, bos, sweep, fvg, ob, premiumDiscount, session, side };
}

// ─── Generate A+ paper signal (replicates generatePaperSignal logic) ───────
// Entry = candle close. SL = OB or Sweep level (direction-aware). TP1 = 2R.
// A+ requires: valid SL geometry + RR in [1.8, 4.0].
function generateAPlusSignal(analysis, entryPrice) {
  const { sweep, ob, side } = analysis;
  let stopLoss = null;

  if (side === "LONG") {
    if (ob && ob.type === "BULLISH" && ob.low != null && ob.low < entryPrice) stopLoss = ob.low;
    else if (sweep && sweep.level != null && sweep.level < entryPrice) stopLoss = sweep.level;
  } else {
    if (ob && ob.type === "BEARISH" && ob.high != null && ob.high > entryPrice) stopLoss = ob.high;
    else if (sweep && sweep.level != null && sweep.level > entryPrice) stopLoss = sweep.level;
  }

  if (!stopLoss) return null;

  const slGeometryValid = side === "LONG" ? stopLoss < entryPrice : stopLoss > entryPrice;
  if (!slGeometryValid) return null;

  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return null;

  const tp1 = side === "LONG" ? entryPrice + risk * 2 : entryPrice - risk * 2;
  const rr = computeRR(entryPrice, stopLoss, tp1);
  if (!rrInAllowedRange(rr)) return null;

  return { entry: entryPrice, stop_loss: stopLoss, tp1, rr, direction: side };
}

// ─── Simulate paper-trade outcome ──────────────────────────────────────────
// Walks future candles. SL hit first = LOSS (conservative). TP1 hit = WIN.
// Neither hit within holding period = TIMEOUT.
function simulateOutcome(setup, futureCandles) {
  const { stop_loss: sl, tp1, direction } = setup;
  for (let i = 0; i < futureCandles.length; i++) {
    const c = futureCandles[i];
    if (direction === "LONG") {
      if (c.low <= sl) return { outcome: "LOSS", bars: i + 1 };
      if (c.high >= tp1) return { outcome: "WIN", bars: i + 1 };
    } else {
      if (c.high >= sl) return { outcome: "LOSS", bars: i + 1 };
      if (c.low <= tp1) return { outcome: "WIN", bars: i + 1 };
    }
  }
  return { outcome: "TIMEOUT", bars: futureCandles.length };
}

// ─── Main backtest function ────────────────────────────────────────────────
export function runAPlusBacktest(candles, options = {}) {
  const windowSize = options.windowSize || 80;
  const holdingPeriod = options.holdingPeriod || 60; // 60 M1 candles = 1 hour
  const cooldown = options.cooldown || 15; // 15 min between setups
  const sides = options.sides || ["LONG", "SHORT"];

  const setups = [];
  let cooldownUntil = 0;

  for (let i = windowSize; i < candles.length - holdingPeriod; i++) {
    if (i < cooldownUntil) continue;

    const entryPrice = candles[i].close;
    const window = candles.slice(i - windowSize, i + 1);

    for (const side of sides) {
      const analysis = evaluateAtCandle(window, side);
      if (!analysis.validatedSetup) continue;

      const signal = generateAPlusSignal(analysis, entryPrice);
      if (!signal) continue;

      const futureCandles = candles.slice(i + 1, i + 1 + holdingPeriod);
      const result = simulateOutcome(signal, futureCandles);

      setups.push({
        index: i,
        time: candles[i].time,
        date: new Date(candles[i].time * 1000).toISOString().split("T")[0],
        side,
        entry: Math.round(signal.entry * 100) / 100,
        stop_loss: Math.round(signal.stop_loss * 100) / 100,
        tp1: Math.round(signal.tp1 * 100) / 100,
        rr: signal.rr,
        session: analysis.session.name,
        outcome: result.outcome,
        bars_to_hit: result.bars,
      });

      cooldownUntil = i + cooldown;
      break; // One setup per cooldown window
    }
  }

  // ─── Statistics ────────────────────────────────────────────────────────
  const wins = setups.filter((s) => s.outcome === "WIN");
  const losses = setups.filter((s) => s.outcome === "LOSS");
  const timeouts = setups.filter((s) => s.outcome === "TIMEOUT");
  const decided = wins.length + losses.length;
  const hitRate = decided > 0 ? (wins.length / decided) * 100 : 0;

  // Per-day breakdown
  const byDay = {};
  for (const s of setups) {
    if (!byDay[s.date]) byDay[s.date] = { date: s.date, total: 0, wins: 0, losses: 0, timeouts: 0 };
    byDay[s.date].total++;
    if (s.outcome === "WIN") byDay[s.date].wins++;
    else if (s.outcome === "LOSS") byDay[s.date].losses++;
    else byDay[s.date].timeouts++;
  }
  const dailyData = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  // Per-session breakdown
  const bySession = {};
  for (const s of setups) {
    if (!bySession[s.session]) bySession[s.session] = { session: s.session, total: 0, wins: 0, losses: 0 };
    bySession[s.session].total++;
    if (s.outcome === "WIN") bySession[s.session].wins++;
    else if (s.outcome === "LOSS") bySession[s.session].losses++;
  }

  return {
    total_setups: setups.length,
    wins: wins.length,
    losses: losses.length,
    timeouts: timeouts.length,
    decided,
    hit_rate: Math.round(hitRate * 10) / 10,
    daily_data: dailyData,
    session_data: Object.values(bySession),
    setups: setups.slice(-20), // Last 20 for detail view
    oldest_candle: candles[0]?.time || null,
    newest_candle: candles[candles.length - 1]?.time || null,
    candle_count: candles.length,
  };
}