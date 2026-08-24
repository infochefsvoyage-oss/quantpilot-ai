// QuantPilot — Symbol Specifications (GO-2: BTCUSD/XAUUSD Production Adapter)
// Default specs for BTCUSD and XAUUSD, with live fetch from MT5 bridge.
// Used by riskGate, paperExecutionEngine, autoOrderPipeline, runMT5Backtest.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

export interface SymbolSpec {
  symbol: string;
  canonical: string;
  contract_size: number;
  tick_size: number;
  tick_value: number;
  digits: number;
  volume_min: number;
  volume_max: number;
  volume_step: number;
  stops_level: number;
  max_spread_points: number;
  sessions: string[];
}

export const DEFAULT_SPECS: Record<string, SymbolSpec> = {
  XAUUSD: {
    symbol: "XAUUSD",
    canonical: "XAUUSD",
    contract_size: 100,
    tick_size: 0.01,
    tick_value: 1,
    digits: 2,
    volume_min: 0.01,
    volume_max: 100,
    volume_step: 0.01,
    stops_level: 50,
    max_spread_points: 50,
    sessions: ["LONDON", "NEW_YORK"],
  },
  BTCUSD: {
    symbol: "BTCUSD",
    canonical: "BTCUSD",
    contract_size: 1,
    tick_size: 0.01,
    tick_value: 0.01,
    digits: 2,
    volume_min: 0.01,
    volume_max: 100,
    volume_step: 0.01,
    stops_level: 100,
    max_spread_points: 100,
    sessions: ["LONDON", "NEW_YORK"],
  },
};

export function getDefaultSpec(symbol: string): SymbolSpec {
  const key = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return DEFAULT_SPECS[key] || {
    symbol,
    canonical: symbol,
    contract_size: 1,
    tick_size: 0.01,
    tick_value: 0.01,
    digits: 2,
    volume_min: 0.01,
    volume_max: 100,
    volume_step: 0.01,
    stops_level: 50,
    max_spread_points: 50,
    sessions: ["LONDON", "NEW_YORK"],
  };
}

export async function fetchSymbolSpec(
  bridgeBase: string,
  headers: Record<string, string>,
  symbol: string
): Promise<SymbolSpec> {
  const defaultSpec = getDefaultSpec(symbol);
  try {
    const res = await fetch(`${bridgeBase}/symbols/${symbol}`, { headers });
    if (!res.ok) return defaultSpec;
    const data = await res.json();
    return {
      ...defaultSpec,
      contract_size: data.contract_size || defaultSpec.contract_size,
      tick_size: data.tick_size || defaultSpec.tick_size,
      tick_value: data.tick_value || defaultSpec.tick_value,
      digits: data.digits || defaultSpec.digits,
      volume_min: data.volume_min || defaultSpec.volume_min,
      volume_max: data.volume_max || defaultSpec.volume_max,
      volume_step: data.volume_step || defaultSpec.volume_step,
      stops_level: data.stops_level || defaultSpec.stops_level,
    };
  } catch {
    return defaultSpec;
  }
}

// Killzone sessions (UTC) — shared across instruments
export const KILLZONES = [
  { name: "ASIA", start: 20, end: 0 },
  { name: "LONDON", start: 2, end: 5 },
  { name: "NEW_YORK", start: 7, end: 10 },
  { name: "LONDON_CLOSE", start: 10, end: 12 },
];

export function isInKillzone(timestampMs: number, sessions: string[]): boolean {
  const h = new Date(timestampMs).getUTCHours();
  for (const s of KILLZONES) {
    if (!sessions.includes(s.name)) continue;
    if (s.start < s.end) { if (h >= s.start && h < s.end) return true; }
    else { if (h >= s.start || h < s.end) return true; }
  }
  return false;
}