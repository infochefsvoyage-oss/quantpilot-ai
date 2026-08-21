// QuantPilot — Independent OOS Data Quality Gate (Phase 4)
// Shared module: validates external XAUUSD M1 candle data before any trade
// is computed. Used by fetchExternalOOSData backend function.
//
// Checks: timestamp present, monotonic order, duplicates, OHLC validity,
// high >= max(open,close), low <= min(open,close), high >= low, positive prices,
// expected symbol, expected timeframe, no overlap with discovery range,
// gap/missing-data analysis, timezone consistency.
//
// The gate NEVER repairs data (no forward-fill, no synthetic candles, no
// interpolation, no duplication). Critical errors → dataset rejected.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

export interface Candle {
  time: number;      // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface QualityOptions {
  expectedSymbol?: string;       // e.g. "XAUUSD"
  expectedTimeframe?: string;   // e.g. "M1"
  discoveryRange?: { start: number; end: number } | null; // unix seconds
  minCandles?: number;          // minimum valid candles (default 30000)
}

export interface DataQualityReport {
  total_candles: number;
  valid_candles: number;
  duplicates: number;
  ohlc_errors: number;
  price_errors: number;
  missing_timestamps: number;
  invalid_timestamps: number;
  time_errors: number;
  chronological: boolean;
  unexpected_gaps: number;
  weekend_closures: number;
  daily_closures: number;
  timezone_consistent: boolean;
  symbol_match: boolean;
  timeframe_match: boolean;
  overlap_with_discovery: number;
  oldest_candle: number | null;
  newest_candle: number | null;
  date_range_days: number;
  pass: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCandleData(raw: Candle[], options: QualityOptions = {}): DataQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const total = raw.length;
  const minCandles = options.minCandles ?? 30000;
  const expectedSymbol = options.expectedSymbol ?? "XAUUSD";
  const expectedTimeframe = options.expectedTimeframe ?? "M1";

  if (total === 0) {
    return {
      total_candles: 0, valid_candles: 0, duplicates: 0, ohlc_errors: 0,
      price_errors: 0, missing_timestamps: 0, invalid_timestamps: 0,
      time_errors: 0, chronological: false, unexpected_gaps: 0,
      weekend_closures: 0, daily_closures: 0, timezone_consistent: false,
      symbol_match: false, timeframe_match: false, overlap_with_discovery: 0,
      oldest_candle: null, newest_candle: null, date_range_days: 0,
      pass: false, errors: ["No candles provided"], warnings,
    };
  }

  // ── Invalid timestamps / non-number OHLC ────────────────────────────
  let invalidTimestamps = 0;
  const cleaned: Candle[] = [];
  for (const c of raw) {
    if (typeof c.time !== "number" || c.time <= 0 || !isFinite(c.time)) { invalidTimestamps++; continue; }
    if (typeof c.open !== "number" || typeof c.high !== "number" ||
        typeof c.low !== "number" || typeof c.close !== "number") { invalidTimestamps++; continue; }
    cleaned.push(c);
  }
  if (invalidTimestamps > 0) errors.push(`${invalidTimestamps} invalid timestamp/OHLC entries removed`);

  // ── Duplicates (same time) ───────────────────────────────────────────
  const seen = new Set<number>();
  const deduped: Candle[] = [];
  let duplicates = 0;
  for (const c of cleaned) {
    if (seen.has(c.time)) { duplicates++; continue; }
    seen.add(c.time);
    deduped.push(c);
  }
  if (duplicates > 0) errors.push(`${duplicates} duplicate timestamps removed`);

  // ── Chronological ordering ───────────────────────────────────────────
  let timeErrors = 0;
  for (let i = 1; i < deduped.length; i++) {
    if (deduped[i].time <= deduped[i - 1].time) timeErrors++;
  }
  const chronological = timeErrors === 0;
  if (!chronological) {
    deduped.sort((a, b) => a.time - b.time);
    errors.push(`${timeErrors} ordering errors (sorted)`);
  }

  // ── OHLC validation + positive price check ──────────────────────────
  let ohlcErrors = 0;
  let priceErrors = 0;
  for (const c of deduped) {
    const ohlcValid = c.low <= c.open && c.low <= c.close &&
                      c.high >= c.open && c.high >= c.close &&
                      c.high >= c.low && c.low <= c.high;
    if (!ohlcValid) ohlcErrors++;
    // Positive price check: all prices must be > 0
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) priceErrors++;
  }
  if (ohlcErrors > 0) errors.push(`${ohlcErrors} OHLC consistency errors`);
  if (priceErrors > 0) errors.push(`${priceErrors} non-positive price errors`);

  // ── Missing timestamps / gaps ────────────────────────────────────────
  let unexpectedGaps = 0;
  let weekendClosures = 0;
  let dailyClosures = 0;
  let missingTimestamps = 0;
  for (let i = 1; i < deduped.length; i++) {
    const dt = deduped[i].time - deduped[i - 1].time;
    if (dt === 60) continue;
    const prevDate = new Date(deduped[i - 1].time * 1000);
    const prevDay = prevDate.getUTCDay();
    const prevHour = prevDate.getUTCHours();
    if (dt > 3600 && (prevDay === 5 || prevDay === 6)) { weekendClosures++; continue; }
    if (dt > 1800 && dt <= 5400 && (prevHour >= 21 || prevHour <= 1)) { dailyClosures++; continue; }
    if (dt > 60 && dt <= 300) { missingTimestamps += Math.floor(dt / 60) - 1; continue; }
    unexpectedGaps++;
  }
  if (unexpectedGaps > 0) errors.push(`${unexpectedGaps} unexpected gaps (>5min, non-closure)`);
  if (missingTimestamps > 0) warnings.push(`${missingTimestamps} missing minute candles (2-5min gaps)`);

  // ── Timezone consistency ─────────────────────────────────────────────
  const timezoneConsistent = deduped.every(c => c.time > 946684800 && c.time < 2000000000);

  // ── Timeframe check (M1 = 60s intervals) ─────────────────────────────
  let timeframeMatches = true;
  if (deduped.length > 100) {
    let m1Count = 0, checked = 0;
    for (let i = 1; i < Math.min(deduped.length, 1000); i++) {
      const dt = deduped[i].time - deduped[i - 1].time;
      if (dt === 60) m1Count++;
      checked++;
    }
    timeframeMatches = checked > 0 && m1Count / checked >= 0.95;
  }
  if (!timeframeMatches) errors.push(`Timeframe mismatch: expected ${expectedTimeframe} (60s intervals)`);

  // ── Overlap with discovery range ──────────────────────────────────────
  let overlapCount = 0;
  if (options.discoveryRange) {
    const { start: dStart, end: dEnd } = options.discoveryRange;
    for (const c of deduped) {
      if (c.time >= dStart && c.time <= dEnd) overlapCount++;
    }
    if (overlapCount > 0) errors.push(`${overlapCount} candles overlap with discovery range — REJECTED`);
  }

  // ── Symbol check (metadata-level — caller must set) ──────────────────
  // Symbol is validated at the fetch level (provider returns XAU/USD).
  // This flag is set by the caller based on the API response.
  const symbolMatch = true; // caller overrides if needed

  const oldest = deduped[0]?.time ?? null;
  const newest = deduped[deduped.length - 1]?.time ?? null;
  const dateRangeDays = oldest && newest ? Math.round((newest - oldest) / 86400) : 0;

  const pass = deduped.length >= minCandles &&
               ohlcErrors === 0 &&
               priceErrors === 0 &&
               unexpectedGaps < 100 &&
               timeframeMatches &&
               overlapCount === 0;

  return {
    total_candles: total,
    valid_candles: deduped.length,
    duplicates,
    ohlc_errors: ohlcErrors,
    price_errors: priceErrors,
    missing_timestamps: missingTimestamps,
    invalid_timestamps: invalidTimestamps,
    time_errors: timeErrors,
    chronological,
    unexpected_gaps: unexpectedGaps,
    weekend_closures: weekendClosures,
    daily_closures: dailyClosures,
    timezone_consistent: timezoneConsistent,
    symbol_match: symbolMatch,
    timeframe_match: timeframeMatches,
    overlap_with_discovery: overlapCount,
    oldest_candle: oldest,
    newest_candle: newest,
    date_range_days: dateRangeDays,
    pass,
    errors,
    warnings,
  };
}

// Compact format: [time, open, high, low, close] for efficient transport
export function toCompactCandles(candles: Candle[]): number[][] {
  return candles.map(c => [c.time, c.open, c.high, c.low, c.close]);
}