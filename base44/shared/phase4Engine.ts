// QuantPilot — Phase 4 Engine (Independent OOS Validation)
// FROZEN NY-LONG hypothesis: NO optimization, NO parameter changes.
// Includes: ICT engine, backtest with MFE/MAE, R-reconciliation,
// reproducibility, statistics, bootstrap, Monte Carlo, walk-forward, control groups.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ─── Session detection (UTC) ──────────────────────────────────────────
export const ICT_SESSIONS = [
  { name: "ASIA", start: 20, end: 0 },
  { name: "LONDON", start: 2, end: 5 },
  { name: "NEW_YORK", start: 7, end: 10 },
  { name: "LONDON_CLOSE", start: 10, end: 12 },
];

export function getSessionAtTime(timestampMs: number) {
  const h = new Date(timestampMs).getUTCHours();
  for (const s of ICT_SESSIONS) {
    if (s.start < s.end) { if (h >= s.start && h < s.end) return s; }
    else { if (h >= s.start || h < s.end) return s; }
  }
  return { name: "OFF" };
}

// ─── ICT Engine ────────────────────────────────────────────────────────
export function detectSwings(candles: Candle[], lookback = 2) {
  const swings: any[] = [];
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

export function detectBOSCHOCH(candles: Candle[], swings: any[]) {
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

export function detectLiquiditySweep(candles: Candle[], swings: any[], lookback = 10) {
  const recent = candles.slice(-lookback);
  if (recent.length < 3 || swings.length < 1) return { sweep: false, direction: "NONE", pool: "NONE", level: null };
  const swingHighs = swings.filter(s => s.type === "HIGH").slice(-3);
  const swingLows = swings.filter(s => s.type === "LOW").slice(-3);
  if (swingHighs.length === 0 || swingLows.length === 0) return { sweep: false, direction: "NONE", pool: "NONE", level: null };
  const maxHigh = Math.max(...swingHighs.map(s => s.price));
  const minLow = Math.min(...swingLows.map(s => s.price));
  for (const c of recent) {
    if (c.high > maxHigh && c.close < maxHigh) return { sweep: true, direction: "UPWARD_SWEEP", pool: "EQUAL_HIGHS", level: maxHigh };
    if (c.low < minLow && c.close > minLow) return { sweep: true, direction: "DOWNWARD_SWEEP", pool: "EQUAL_LOWS", level: minLow };
  }
  return { sweep: false, direction: "NONE", pool: "NONE", level: null };
}

export function detectFVG(candles: Candle[], lookback = 30) {
  const recent = candles.slice(-lookback);
  for (let i = 2; i < recent.length; i++) {
    const c1 = recent[i - 2], c3 = recent[i];
    if (c3.low > c1.high) return { detected: true, type: "BULLISH", top: c3.low, bottom: c1.high };
    if (c3.high < c1.low) return { detected: true, type: "BEARISH", top: c1.low, bottom: c3.high };
  }
  return { detected: false, type: null, top: null, bottom: null };
}

export function detectOrderBlock(candles: Candle[], lookback = 20) {
  const recent = candles.slice(-lookback);
  for (let i = recent.length - 2; i >= 1; i--) {
    const c = recent[i], next = recent[i + 1];
    if (c.close < c.open && next.close > next.open && (next.close - next.open) > Math.abs(c.open - c.close))
      return { detected: true, type: "BULLISH", high: c.high, low: c.low };
    if (c.close > c.open && next.close < next.open && (next.open - next.close) > Math.abs(c.open - c.close))
      return { detected: true, type: "BEARISH", high: c.high, low: c.low };
  }
  return { detected: false, type: null, high: null, low: null };
}

export function computePremiumDiscount(candles: Candle[], lookback = 50) {
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

export function computeRR(entry: number, sl: number, tp: number) {
  if (!entry || !sl || !tp) return 0;
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  return risk === 0 ? 0 : reward / risk;
}

export function rrInAllowedRange(rr: number) {
  return rr >= 1.8 && rr <= 4.0;
}

// ─── A+ Signal Generation (FROZEN) ─────────────────────────────────────
function evaluateAtCandle(window: Candle[], side: string) {
  const swings = detectSwings(window);
  const bos = detectBOSCHOCH(window, swings);
  const sweep = detectLiquiditySweep(window, swings);
  const fvg = detectFVG(window);
  const ob = detectOrderBlock(window);
  const pd = computePremiumDiscount(window);
  const lastCandle = window[window.length - 1];
  const session = getSessionAtTime(lastCandle.time * 1000);

  const hasSweep = !!(sweep && sweep.sweep);
  const hasDisplacement = !!(bos && bos.mss_bos !== "NONE");
  const hasFVGorOB = !!((fvg && fvg.detected) || (ob && ob.detected));
  const sideAligned = side === "LONG"
    ? !!(bos && bos.direction === "BULLISH" && pd.zone === "DISCOUNT")
    : !!(bos && bos.direction === "BEARISH" && pd.zone === "PREMIUM");
  const inKillzone = !!(session && (session.name === "LONDON" || session.name === "NEW_YORK"));

  const validatedSetup = hasSweep && hasDisplacement && hasFVGorOB && sideAligned && inKillzone;
  return { validatedSetup, sweep, ob, session, side };
}

function generateAPlusSignal(analysis: any, entryPrice: number) {
  const { sweep, ob, side } = analysis;
  let stopLoss: number | null = null;
  if (side === "LONG") {
    if (ob && ob.type === "BULLISH" && ob.low != null && ob.low < entryPrice) stopLoss = ob.low;
    else if (sweep && sweep.level != null && sweep.level < entryPrice) stopLoss = sweep.level;
  } else {
    if (ob && ob.type === "BEARISH" && ob.high != null && ob.high > entryPrice) stopLoss = ob.high;
    else if (sweep && sweep.level != null && sweep.level > entryPrice) stopLoss = sweep.level;
  }
  if (!stopLoss) return null;
  if (side === "LONG" ? stopLoss >= entryPrice : stopLoss <= entryPrice) return null;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return null;
  const tp1 = side === "LONG" ? entryPrice + risk * 2 : entryPrice - risk * 2;
  const rr = computeRR(entryPrice, stopLoss, tp1);
  if (!rrInAllowedRange(rr)) return null;
  return { entry: entryPrice, stop_loss: stopLoss, tp1, rr, direction: side };
}

// ─── Outcome simulation with MFE/MAE ──────────────────────────────────
function simulateOutcome(setup: any, futureCandles: Candle[]) {
  const { stop_loss: sl, tp1, direction } = setup;
  let mfe = 0, mae = 0;
  const risk = Math.abs(setup.entry - sl);
  if (risk === 0) return { outcome: "TIMEOUT", bars: futureCandles.length, mfe: 0, mae: 0, exitPrice: setup.entry };

  for (let i = 0; i < futureCandles.length; i++) {
    const c = futureCandles[i];
    // MFE/MAE only from candles AFTER entry (no look-ahead)
    if (direction === "LONG") {
      mfe = Math.max(mfe, (c.high - setup.entry) / risk);
      mae = Math.max(mae, (setup.entry - c.low) / risk);
      if (c.low <= sl) return { outcome: "LOSS", bars: i + 1, mfe: Math.round(mfe * 100) / 100, mae: Math.round(mae * 100) / 100, exitPrice: sl };
      if (c.high >= tp1) return { outcome: "WIN", bars: i + 1, mfe: Math.round(mfe * 100) / 100, mae: Math.round(mae * 100) / 100, exitPrice: tp1 };
    } else {
      mfe = Math.max(mfe, (setup.entry - c.low) / risk);
      mae = Math.max(mae, (c.high - setup.entry) / risk);
      if (c.high >= sl) return { outcome: "LOSS", bars: i + 1, mfe: Math.round(mfe * 100) / 100, mae: Math.round(mae * 100) / 100, exitPrice: sl };
      if (c.low <= tp1) return { outcome: "WIN", bars: i + 1, mfe: Math.round(mfe * 100) / 100, mae: Math.round(mae * 100) / 100, exitPrice: tp1 };
    }
  }
  return { outcome: "TIMEOUT", bars: futureCandles.length, mfe: Math.round(mfe * 100) / 100, mae: Math.round(mae * 100) / 100, exitPrice: futureCandles[futureCandles.length - 1].close };
}

// ─── Backtest (FROZEN hypothesis) ─────────────────────────────────────
export function runBacktest(candles: Candle[], filterSession: string | null, filterSide: string | null) {
  const windowSize = 80, holdingPeriod = 60, cooldown = 15;
  const setups: any[] = [];
  let cooldownUntil = 0;
  for (let i = windowSize; i < candles.length - holdingPeriod; i++) {
    if (i < cooldownUntil) continue;
    const entryPrice = candles[i].close;
    const window = candles.slice(i - windowSize, i + 1);
    for (const side of ["LONG", "SHORT"]) {
      const a = evaluateAtCandle(window, side);
      if (!a.validatedSetup) continue;
      if (filterSession && a.session.name !== filterSession) continue;
      if (filterSide && side !== filterSide) continue;
      const sig = generateAPlusSignal(a, entryPrice);
      if (!sig) continue;
      const future = candles.slice(i + 1, i + 1 + holdingPeriod);
      const res = simulateOutcome(sig, future);
      const rMult = res.outcome === "WIN" ? sig.rr : res.outcome === "LOSS" ? -1 : 0;
      // R-reconciliation: recalculate R from entry/SL/TP/exit
      const recalculatedR = res.outcome === "WIN"
        ? Math.round((Math.abs(res.exitPrice - sig.entry) / Math.abs(sig.entry - sig.stop_loss)) * 100) / 100
        : res.outcome === "LOSS" ? -1 : 0;
      const rReconciliationPass = Math.abs(rMult - recalculatedR) < 0.02;
      setups.push({
        idx: i, time: candles[i].time,
        timestamp: new Date(candles[i].time * 1000).toISOString(),
        side, session: a.session.name,
        entry: Math.round(entryPrice * 100) / 100,
        sl: Math.round(sig.stop_loss * 100) / 100,
        tp: Math.round(sig.tp1 * 100) / 100,
        rr: sig.rr, outcome: res.outcome, bars: res.bars,
        rMult: Math.round(rMult * 100) / 100,
        recalculatedR,
        rReconciliationPass,
        mfe: res.mfe, mae: res.mae,
        exitPrice: Math.round(res.exitPrice * 100) / 100,
      });
      cooldownUntil = i + cooldown;
      break;
    }
  }
  return setups;
}

// ─── Statistics ────────────────────────────────────────────────────────
export function calcStats(setups: any[]) {
  const wins = setups.filter(s => s.outcome === "WIN").length;
  const losses = setups.filter(s => s.outcome === "LOSS").length;
  const ties = setups.filter(s => s.outcome === "TIMEOUT").length;
  const decided = wins + losses;
  const winrate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0;
  const totalR = Math.round(setups.reduce((a, s) => a + s.rMult, 0) * 100) / 100;
  const n = setups.length;
  const rVals = setups.map(s => s.rMult);
  const meanR = n > 0 ? rVals.reduce((a, b) => a + b, 0) / n : 0;
  const avgR = Math.round(meanR * 1000) / 1000;
  const rSorted = [...rVals].sort((a, b) => a - b);
  const medianR = n > 0 ? Math.round(rSorted[Math.floor(n / 2)] * 100) / 100 : 0;
  const variance = n > 1 ? rVals.reduce((a, b) => a + (b - meanR) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const se = n > 0 ? sd / Math.sqrt(n) : 0;
  const tcrit = tCrit95(n - 1);
  const ciLo = n > 0 ? Math.round((meanR - tcrit * se) * 1000) / 1000 : 0;
  const ciHi = n > 0 ? Math.round((meanR + tcrit * se) * 1000) / 1000 : 0;
  const totalWinR = setups.filter(s => s.outcome === "WIN").reduce((a, s) => a + s.rMult, 0);
  const totalLossR = Math.abs(setups.filter(s => s.outcome === "LOSS").reduce((a, s) => a + s.rMult, 0));
  const pf = totalLossR !== 0 ? Math.round((totalWinR / totalLossR) * 100) / 100 : (totalWinR > 0 ? 99 : 0);
  let run = 0, peak = 0, maxDD = 0;
  for (const s of setups) { run += s.rMult; if (run > peak) peak = run; const dd = peak - run; if (dd > maxDD) maxDD = dd; }
  let maxLS = 0, curL = 0, maxWS = 0, curW = 0;
  for (const s of setups) {
    if (s.outcome === "LOSS") { curL++; maxLS = Math.max(maxLS, curL); curW = 0; }
    else if (s.outcome === "WIN") { curW++; maxWS = Math.max(maxWS, curW); curL = 0; }
    else { curL = 0; curW = 0; }
  }
  const avgHold = n > 0 ? Math.round(setups.reduce((a, s) => a + s.bars, 0) / n) : 0;
  return { n, wins, losses, ties, winrate, totalR, avgR, medianR, pf, maxDD: Math.round(maxDD * 100) / 100, maxLS, maxWS, avgHold, meanR, ciLo, ciHi, stdDev: Math.round(sd * 100) / 100 };
}

function normalCDF(x: number) {
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x < 0 ? 1 - y : y;
}

export function cohensD(setups: any[]) {
  const n = setups.length;
  if (n < 2) return 0;
  const r = setups.map(s => s.rMult);
  const m = r.reduce((a, b) => a + b, 0) / n;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(v);
  return sd > 0 ? Math.round((m / sd) * 100) / 100 : 0;
}

export function powerAndN(n: number, d: number) {
  if (n === 0 || d === 0) return { power: 0, requiredN: 82 };
  const zA = 1.96;
  const nc = Math.abs(d) * Math.sqrt(n);
  const power = Math.round(normalCDF(nc - zA) * 1000) / 1000;
  return { power, requiredN: 82 };
}

// ─── t-distribution helpers (correct small-sample statistics) ─────────
// p-value must ALWAYS be in [0,1]. CI must use t-critical, not z=1.96.
function logGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y++; ser += c[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / z);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

// Two-tailed t-distribution p-value — ALWAYS clamped to [0,1]
export function tTestPValue(tStat: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + tStat * tStat);
  const pOneTail = betai(df / 2, 0.5, x);
  return Math.min(1, Math.max(0, 2 * Math.min(pOneTail, 1 - pOneTail)));
}

// t-critical value for two-tailed 95% CI (lookup + interpolation)
const T_CRIT_95: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021, 60: 2.000,
  120: 1.980, 999: 1.960,
};

export function tCrit95(df: number): number {
  if (df <= 0) return 1.96;
  if (T_CRIT_95[df]) return T_CRIT_95[df];
  const keys = Object.keys(T_CRIT_95).map(Number).sort((a, b) => a - b);
  let lo = keys[0], hi = keys[keys.length - 1];
  for (const k of keys) {
    if (k <= df) lo = k;
    if (k >= df) { hi = k; break; }
  }
  if (lo === hi) return T_CRIT_95[lo];
  return T_CRIT_95[lo] + (T_CRIT_95[hi] - T_CRIT_95[lo]) * (df - lo) / (hi - lo);
}

export function tTestP(setups: any[]) {
  const n = setups.length;
  if (n < 2) return 1;
  const r = setups.map(s => s.rMult);
  const m = r.reduce((a, b) => a + b, 0) / n;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(v);
  const se = sd / Math.sqrt(n);
  const t = se > 0 ? m / se : 0;
  const df = n - 1;
  const p = tTestPValue(Math.abs(t), df);
  return Math.round(p * 10000) / 10000;
}

// ─── Bootstrap (10k resamples, WITH REPLACEMENT) ──────────────────────
export function bootstrap(setups: any[], iterations = 10000) {
  const rVals = setups.map(s => s.rMult);
  const n = rVals.length;
  if (n === 0) return { meanCiLo: 0, meanCiHi: 0, wrCiLo: 0, wrCiHi: 0, pfCiLo: 0, pfCiHi: 0, medianTotalR: 0, p5TotalR: 0, p95TotalR: 0 };
  let seed = 42;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const means: number[] = [], winrates: number[] = [], pfs: number[] = [];
  for (let it = 0; it < iterations; it++) {
    let sum = 0, wins = 0, losses = 0, tWinR = 0, tLossR = 0;
    for (let i = 0; i < n; i++) {
      const r = rVals[Math.floor(rng() * n)];
      sum += r;
      if (r > 0) { wins++; tWinR += r; } else if (r < 0) { losses++; tLossR += Math.abs(r); }
    }
    means.push(sum / n);
    const dec = wins + losses;
    winrates.push(dec > 0 ? wins / dec : 0);
    pfs.push(tLossR > 0 ? tWinR / tLossR : (tWinR > 0 ? 99 : 0));
  }
  means.sort((a, b) => a - b); winrates.sort((a, b) => a - b); pfs.sort((a, b) => a - b);
  const lo = Math.floor(iterations * 0.025), hi = Math.floor(iterations * 0.975);
  return {
    meanCiLo: Math.round(means[lo] * 1000) / 1000, meanCiHi: Math.round(means[hi] * 1000) / 1000,
    wrCiLo: Math.round(winrates[lo] * 1000) / 10, wrCiHi: Math.round(winrates[hi] * 1000) / 10,
    pfCiLo: Math.round(pfs[lo] * 100) / 100, pfCiHi: Math.round(pfs[hi] * 100) / 100,
    medianTotalR: Math.round(means[Math.floor(iterations * 0.5)] * n * 100) / 100,
    p5TotalR: Math.round(means[lo] * n * 100) / 100, p95TotalR: Math.round(means[hi] * n * 100) / 100,
  };
}

// ─── Monte Carlo (10k resamples, WITH REPLACEMENT) ────────────────────
export function monteCarlo(setups: any[], iterations = 10000, ddThreshold = 5) {
  const rVals = setups.map(s => s.rMult);
  const n = rVals.length;
  if (n === 0) return { expTotalR: 0, medianTotalR: 0, p5TotalR: 0, p95TotalR: 0, pTotalRPos: 0, expMaxDD: 0, p95DD: 0, pDDOverThreshold: 0 };
  let seed = 777;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const totalRs: number[] = [], maxDDs: number[] = [];
  for (let it = 0; it < iterations; it++) {
    let total = 0, running = 0, peak = 0, maxDD = 0;
    for (let i = 0; i < n; i++) {
      const r = rVals[Math.floor(rng() * n)];
      total += r; running += r;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDD) maxDD = dd;
    }
    totalRs.push(total); maxDDs.push(maxDD);
  }
  totalRs.sort((a, b) => a - b); maxDDs.sort((a, b) => a - b);
  return {
    expTotalR: Math.round((totalRs.reduce((a, b) => a + b, 0) / iterations) * 100) / 100,
    medianTotalR: Math.round(totalRs[Math.floor(iterations * 0.5)] * 100) / 100,
    p5TotalR: Math.round(totalRs[Math.floor(iterations * 0.05)] * 100) / 100,
    p95TotalR: Math.round(totalRs[Math.floor(iterations * 0.95)] * 100) / 100,
    pTotalRPos: Math.round((totalRs.filter(t => t > 0).length / iterations) * 1000) / 1000,
    expMaxDD: Math.round((maxDDs.reduce((a, b) => a + b, 0) / iterations) * 100) / 100,
    p95DD: Math.round(maxDDs[Math.floor(iterations * 0.95)] * 100) / 100,
    pDDOverThreshold: Math.round((maxDDs.filter(d => d > ddThreshold).length / iterations) * 1000) / 1000,
  };
}

// ─── Walk-Forward (global indices, 5+ blocks) ─────────────────────────
export function walkForward(setups: any[], totalCandles: number, numBlocks = 5) {
  const blockSize = Math.floor(totalCandles / numBlocks);
  const blocks: any[] = [];
  for (let b = 0; b < numBlocks; b++) {
    const sIdx = b * blockSize, eIdx = b === numBlocks - 1 ? totalCandles : (b + 1) * blockSize;
    const bSetups = setups.filter(s => s.idx >= sIdx && s.idx < eIdx);
    const st = calcStats(bSetups);
    blocks.push({ block: b + 1, global_start_idx: sIdx, global_end_idx: eIdx, trades: st.n, wr: st.winrate, totalR: st.totalR, pf: st.pf, maxDD: st.maxDD });
  }
  return blocks;
}

// ─── Reproducibility (Run 1 == Run 2) ─────────────────────────────────
export function checkReproducibility(setups1: any[], setups2: any[]) {
  if (setups1.length !== setups2.length) return { pass: false, reason: "trade_count_mismatch" };
  for (let i = 0; i < setups1.length; i++) {
    const a = setups1[i], b = setups2[i];
    if (a.idx !== b.idx) return { pass: false, reason: `idx_mismatch_at_${i}` };
    if (a.side !== b.side) return { pass: false, reason: `side_mismatch_at_${i}` };
    if (a.entry !== b.entry) return { pass: false, reason: `entry_mismatch_at_${i}` };
    if (a.outcome !== b.outcome) return { pass: false, reason: `outcome_mismatch_at_${i}` };
    if (a.rMult !== b.rMult) return { pass: false, reason: `rMult_mismatch_at_${i}` };
    if (a.mfe !== b.mfe) return { pass: false, reason: `mfe_mismatch_at_${i}` };
    if (a.mae !== b.mae) return { pass: false, reason: `mae_mismatch_at_${i}` };
  }
  return { pass: true, reason: "RUN1_EQUALS_RUN2" };
}

// ─── Full Phase 4 Validation ──────────────────────────────────────────
export function runPhase4Validation(candles: Candle[], discoveryEndUnix: number | null) {
  // OOS boundary: all candles after discovery end
  const oosCandles = discoveryEndUnix
    ? candles.filter(c => c.time > discoveryEndUnix)
    : candles;

  const oosStart = oosCandles.length > 0 ? oosCandles[0].time : null;
  const oosEnd = oosCandles.length > 0 ? oosCandles[oosCandles.length - 1].time : null;
  const independentOOS = !discoveryEndUnix || (oosStart !== null && oosStart > discoveryEndUnix);

  // Run FROZEN NY-LONG hypothesis (Run 1)
  const nyLong1 = runBacktest(oosCandles, "NEW_YORK", "LONG");
  // Run again for reproducibility (Run 2 — deterministic, should be identical)
  const nyLong2 = runBacktest(oosCandles, "NEW_YORK", "LONG");

  // Control groups (diagnostic only)
  const nyShort = runBacktest(oosCandles, "NEW_YORK", "SHORT");
  const londonLong = runBacktest(oosCandles, "LONDON", "LONG");
  const londonShort = runBacktest(oosCandles, "LONDON", "SHORT");

  // Stats
  const stats = calcStats(nyLong1);
  const d = cohensD(nyLong1);
  const { power, requiredN } = powerAndN(nyLong1.length, d);
  const pValue = tTestP(nyLong1);

  // Bootstrap + Monte Carlo
  const boot = bootstrap(nyLong1, 10000);
  const mc = monteCarlo(nyLong1, 10000, 5);

  // Walk-forward (5+ blocks, global indices)
  const wf = walkForward(nyLong1, oosCandles.length, Math.min(10, Math.max(5, Math.floor(nyLong1.length / 3) || 5)));

  // Control group stats
  const ctrlNYShort = calcStats(nyShort);
  const ctrlLondonLong = calcStats(londonLong);
  const ctrlLondonShort = calcStats(londonShort);

  // Reproducibility
  const reproducibility = checkReproducibility(nyLong1, nyLong2);

  // R-reconciliation
  const rReconciliationPass = nyLong1.every(s => s.rReconciliationPass);
  const rReconciliationFailed = nyLong1.filter(s => !s.rReconciliationPass);

  // MFE/MAE summary
  const mfeMae = {
    avgMfe: nyLong1.length > 0 ? Math.round((nyLong1.reduce((a, s) => a + s.mfe, 0) / nyLong1.length) * 100) / 100 : 0,
    avgMae: nyLong1.length > 0 ? Math.round((nyLong1.reduce((a, s) => a + s.mae, 0) / nyLong1.length) * 100) / 100 : 0,
    maxMfe: nyLong1.length > 0 ? Math.round(Math.max(...nyLong1.map(s => s.mfe)) * 100) / 100 : 0,
    maxMae: nyLong1.length > 0 ? Math.round(Math.max(...nyLong1.map(s => s.mae)) * 100) / 100 : 0,
  };

  // Classification (governance automatic)
  let finalClass: string;
  if (!independentOOS) finalClass = "NOT_INDEPENDENT_OOS";
  else if (nyLong1.length < 10) finalClass = "INSUFFICIENT_DATA";
  else if (nyLong1.length < requiredN || power < 0.8 || stats.ciLo <= 0 || boot.meanCiLo <= 0)
    finalClass = "INCONCLUSIVE_UNDERPOWERED";
  else if (stats.totalR > 0 && stats.ciLo > 0 && boot.meanCiLo > 0 && power >= 0.8 &&
           wf.filter((b: any) => b.totalR > 0).length >= Math.floor(wf.length * 0.6))
    finalClass = "INDEPENDENT_OOS_CONFIRMED";
  else finalClass = "EDGE_NOT_CONFIRMED";

  return {
    oos_data_available: oosCandles.length >= 30000,
    oos_candle_count: oosCandles.length,
    oos_range: { start: oosStart, end: oosEnd },
    discovery_end: discoveryEndUnix,
    independent_oos: independentOOS,
    trade_count: stats.n,
    wins: stats.wins, losses: stats.losses, ties: stats.ties,
    winrate: stats.winrate, totalR: stats.totalR, avgR: stats.avgR, medianR: stats.medianR,
    profit_factor: stats.pf, max_drawdown: stats.maxDD,
    max_loss_streak: stats.maxLS, max_win_streak: stats.maxWS, avg_hold: stats.avgHold,
    mean_r: stats.avgR, ci_95: [stats.ciLo, stats.ciHi],
    cohens_d: d, p_value: pValue, power, required_n: 82,
    bootstrap: { ...boot, method: "WITH REPLACEMENT", iterations: 10000 },
    monte_carlo: { ...mc, method: "WITH REPLACEMENT", iterations: 10000 },
    walk_forward: { blocks: wf, positive: wf.filter((b: any) => b.totalR > 0).length, negative: wf.filter((b: any) => b.totalR < 0).length, zero: wf.filter((b: any) => b.totalR === 0).length },
    control_groups: {
      ny_short: { n: ctrlNYShort.n, wr: ctrlNYShort.winrate, r: ctrlNYShort.totalR, pf: ctrlNYShort.pf },
      london_long: { n: ctrlLondonLong.n, wr: ctrlLondonLong.winrate, r: ctrlLondonLong.totalR, pf: ctrlLondonLong.pf },
      london_short: { n: ctrlLondonShort.n, wr: ctrlLondonShort.winrate, r: ctrlLondonShort.totalR, pf: ctrlLondonShort.pf },
    },
    r_reconciliation: { pass: rReconciliationPass, failed_count: rReconciliationFailed.length, failed_trades: rReconciliationFailed.map(s => s.timestamp) },
    mfe_mae: mfeMae,
    reproducibility: { pass: reproducibility.pass, reason: reproducibility.reason },
    trades: nyLong1.map(s => ({
      timestamp: s.timestamp, side: s.side, session: s.session,
      entry: s.entry, sl: s.sl, tp: s.tp, rr: s.rr,
      outcome: s.outcome, bars: s.bars, r: s.rMult,
      recalculated_r: s.recalculatedR, r_reconciliation_pass: s.rReconciliationPass,
      mfe: s.mfe, mae: s.mae, exit_price: s.exitPrice,
    })),
    classification: finalClass,
    hypothesis_locked: true,
    optimization: "NONE",
    order_send: "BLOCKED",
    live_execution: "BLOCKED",
  };
}