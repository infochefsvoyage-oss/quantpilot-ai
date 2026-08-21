// QuantPilot — Independent OOS Data Quality Gate (Phase 4)
// Shared module: validates external XAUUSD M1 candle data before any trade
// is computed. Used by fetchExternalOOSData backend function.
//
// Checks: duplicates, OHLC errors, missing/invalid timestamps, chronological
// ordering, unexpected gaps, weekend/market closures, timezone consistency.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

export interface Candle {
  time: number;      // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DataQualityReport {
  total_candles: number;
  valid_candles: number;
  duplicates: number;
  ohlc_errors: number;
  missing_timestamps: number;
  invalid_timestamps: number;
  time_errors: number;
  chronological: boolean;
  unexpected_gaps: number;
  weekend_closures: number;
  daily_closures: number;
  timezone_consistent: boolean;
  oldest_candle: number | null;
  newest_candle: number | null;
  date_range_days: number;
  pass: boolean;
  errors: string[];
}

export function validateCandleData(raw: Candle[]): DataQualityReport {
  const errors: string[] = [];
  const total = raw.length;

  if (total === 0) {
    return {
      total_candles: 0, valid_candles: 0, duplicates: 0, ohlc_errors: 0,
      missing_timestamps: 0, invalid_timestamps: 0, time_errors: 0,
      chronological: false, unexpected_gaps: 0, weekend_closures: 0,
      daily_closures: 0, timezone_consistent: false,
      oldest_candle: null, newest_candle: null, date_range_days: 0,
      pass: false, errors: ["No candles provided"],
    };
  }

  // ── Invalid timestamps (non-number, <= 0) ────────────────────────────
  let invalidTimestamps = 0;
  const cleaned: Candle[] = [];
  for (const c of raw) {
    if (typeof c.time !== "number" || c.time <= 0 || !isFinite(c.time)) {
      invalidTimestamps++;
      continue;
    }
    if (typeof c.open !== "number" || typeof c.high !== "number" ||
        typeof c.low !== "number" || typeof c.close !== "number") {
      invalidTimestamps++;
      continue;
    }
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
    // Sort chronologically
    deduped.sort((a, b) => a.time - b.time);
    errors.push(`${timeErrors} ordering errors (sorted)`);
  }

  // ── OHLC validation ──────────────────────────────────────────────────
  let ohlcErrors = 0;
  for (const c of deduped) {
    if (!(c.low <= c.open && c.low <= c.close &&
          c.high >= c.open && c.high >= c.close &&
          c.high >= c.low && c.low <= c.high)) {
      ohlcErrors++;
    }
  }
  if (ohlcErrors > 0) errors.push(`${ohlcErrors} OHLC consistency errors`);

  // ── Missing timestamps (gaps where dt != 60s) ─────────────────────────
  let unexpectedGaps = 0;
  let weekendClosures = 0;
  let dailyClosures = 0;
  let missingTimestamps = 0;
  for (let i = 1; i < deduped.length; i++) {
    const dt = deduped[i].time - deduped[i - 1].time;
    if (dt === 60) continue; // perfect M1 cadence

    const prevDate = new Date(deduped[i - 1].time * 1000);
    const prevDay = prevDate.getUTCDay();
    const prevHour = prevDate.getUTCHours();

    // Weekend closure (Fri evening → Sun evening): dt > 3600 and Fri/Sat
    if (dt > 3600 && (prevDay === 5 || prevDay === 6)) {
      weekendClosures++;
      continue;
    }
    // Daily market closure (22:00-23:00 UTC typical XAUUSD break): dt 1800-5400
    if (dt > 1800 && dt <= 5400 && (prevHour >= 21 || prevHour <= 1)) {
      dailyClosures++;
      continue;
    }
    // Minor gap (2-5 minutes): count as missing
    if (dt > 60 && dt <= 300) {
      missingTimestamps += Math.floor(dt / 60) - 1;
      continue;
    }
    // Unexpected gap (> 5 min, not closure)
    unexpectedGaps++;
  }
  if (unexpectedGaps > 0) errors.push(`${unexpectedGaps} unexpected gaps (>5min, non-closure)`);
  if (missingTimestamps > 0) errors.push(`${missingTimestamps} missing minute candles (2-5min gaps)`);

  // ── Timezone consistency (all timestamps should be valid unix seconds) ──
  const timezoneConsistent = deduped.every(c => c.time > 946684800 && c.time < 2000000000);

  const oldest = deduped[0]?.time ?? null;
  const newest = deduped[deduped.length - 1]?.time ?? null;
  const dateRangeDays = oldest && newest ? Math.round((newest - oldest) / 86400) : 0;

  const pass = deduped.length >= 30000 && ohlcErrors === 0 && unexpectedGaps < 100;

  return {
    total_candles: total,
    valid_candles: deduped.length,
    duplicates,
    ohlc_errors: ohlcErrors,
    missing_timestamps: missingTimestamps,
    invalid_timestamps: invalidTimestamps,
    time_errors: timeErrors,
    chronological,
    unexpected_gaps: unexpectedGaps,
    weekend_closures: weekendClosures,
    daily_closures: dailyClosures,
    timezone_consistent: timezoneConsistent,
    oldest_candle: oldest,
    newest_candle: newest,
    date_range_days: dateRangeDays,
    pass,
    errors,
  };
}

// Compact format: [time, open, high, low, close] for efficient transport
export function toCompactCandles(candles: Candle[]): number[][] {
  return candles.map(c => [c.time, c.open, c.high, c.low, c.close]);
}