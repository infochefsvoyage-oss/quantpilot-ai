// QuantPilot — Forward Observation Shared Module
// FROZEN strategy version, parameter hash, deterministic trade fingerprint,
// and trade-format converters for combined statistics.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

// ─── FROZEN Strategy Identity ──────────────────────────────────────────
export const STRATEGY_VERSION = "NY_LONG_V1_FROZEN";

const FROZEN_PARAMS =
  "NY_LONG|SESSION=NEW_YORK|DIR=LONG|RR_MIN=2.5|TP1=40|TP2=30|TP3=30|HOLD_MAX=60|COOLDOWN=30";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & 0xffffffff;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export const PARAMETER_HASH = simpleHash(FROZEN_PARAMS);

// ─── Deterministic Trade Fingerprint ──────────────────────────────────
// Used for duplicate detection. Two trades with the same fingerprint
// are the same trade — duplicates must NOT increase N.
export function computeFingerprint(t: {
  symbol: string;
  signal_timestamp: number;
  entry_timestamp: number;
  entry_price: number;
  direction: string;
  strategy_version: string;
}): string {
  return [
    t.symbol,
    t.strategy_version,
    t.signal_timestamp,
    t.entry_timestamp,
    t.entry_price.toFixed(5),
    t.direction,
  ].join("|");
}

// ─── Trade Format Converters ──────────────────────────────────────────
// Convert stored trades to the setup format expected by phase4Engine
// calcStats, cohensD, powerAndN, tTestP, bootstrap, walkForward.

export function historicalTradesToSetups(trades: any[]) {
  return (trades || []).map((t) => ({
    rMult: t.r,
    outcome: t.outcome,
    bars: t.bars || 0,
    mfe: t.mfe || 0,
    mae: t.mae || 0,
  }));
}

export function forwardTradesToSetups(trades: any[]) {
  return (trades || []).map((t) => ({
    rMult: t.r_multiple,
    outcome:
      t.r_multiple > 0 ? "WIN" : t.r_multiple < 0 ? "LOSS" : "TIMEOUT",
    bars: t.time_in_trade || 0,
    mfe: t.mfe || 0,
    mae: t.mae || 0,
  }));
}