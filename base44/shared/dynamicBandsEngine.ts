export type DynamicBandState =
  | "BALANCED"
  | "UPTREND"
  | "DOWNTREND"
  | "OVEREXTENDED"
  | "NO_TRADE";

export type DynamicScenario = "RANGE" | "PULLBACK" | "REVERSAL" | "NONE";
export type DynamicDirection = "BUY" | "SELL" | "NONE";

export type SequenceExitReason =
  | "TARGET_TOUCHED"
  | "TIME_LIMIT"
  | "LOSS_LIMIT"
  | "PROFIT_TARGET"
  | "NONE";

export interface DynamicBandsInput {
  state: DynamicBandState;
  close: number;
  candleHigh: number;
  candleLow: number;
  candleTime: string | number;
  center: number;
  upperBands: [number, number, number, number];
  lowerBands: [number, number, number, number];
  trendDirection?: "UP" | "DOWN" | "NEUTRAL";
  candleIndex?: number;
}

export interface BandTrigger {
  bandIndex: 1 | 2 | 3 | 4;
  triggerPrice: number;
  direction: "BUY" | "SELL";
}

export interface DynamicEntry {
  bandIndex: 1 | 2 | 3 | 4;
  triggerPrice: number;
  entryPrice: number;
  entryCandleTime: string | number;
  direction: "BUY" | "SELL";
}

export interface DynamicScenarioDecision {
  state: DynamicBandState;
  scenario: DynamicScenario;
  direction: DynamicDirection;
  maxEntries: 2 | 3 | 4 | 0;
  targetPrice: number | null;
  allowEntry: boolean;
  reason: string;
}

export interface SequenceSizing {
  totalLots: number;
  trancheLots: number[];
  maxEntries: number;
}

/**
 * Dynamic Bands strategy adapter.
 *
 * Important source-of-truth boundaries:
 * - Band calculation is intentionally NOT implemented here. The supplied
 *   indicator uses configurable parameters (Period 90, band multipliers
 *   2 / 2.5 / 4 / 5, TrendPeriod 1000, ATRPeriod 14), but the proprietary
 *   .algo formula is not decoded here.
 * - A wick/price touch is a TRIGGER only. The strategy entry is the same
 *   candle's CLOSE.
 * - Dynamic Bands is kept separate from ICT Sniper logic.
 */

export function mapScenario(state: DynamicBandState): DynamicScenario {
  switch (state) {
    case "BALANCED":
      return "RANGE";
    case "UPTREND":
    case "DOWNTREND":
      return "PULLBACK";
    case "OVEREXTENDED":
      return "REVERSAL";
    default:
      return "NONE";
  }
}

export function scenarioDecision(input: Pick<DynamicBandsInput, "state" | "center" | "trendDirection">): DynamicScenarioDecision {
  const { state, center, trendDirection = "NEUTRAL" } = input;

  if (state === "NO_TRADE") {
    return {
      state,
      scenario: "NONE",
      direction: "NONE",
      maxEntries: 0,
      targetPrice: null,
      allowEntry: false,
      reason: "NO_TRADE is a valid protective state; no new sequence may start.",
    };
  }

  if (state === "BALANCED") {
    return {
      state,
      scenario: "RANGE",
      direction: "NONE",
      maxEntries: 3,
      targetPrice: center,
      allowEntry: true,
      reason: "Range: lower zone BUY / upper zone SELL; objective is return to center.",
    };
  }

  if (state === "UPTREND") {
    return {
      state,
      scenario: "PULLBACK",
      direction: "BUY",
      maxEntries: 4,
      targetPrice: center,
      allowEntry: trendDirection !== "DOWN",
      reason: "Uptrend: trade the pullback in trend direction, not against the trend.",
    };
  }

  if (state === "DOWNTREND") {
    return {
      state,
      scenario: "PULLBACK",
      direction: "SELL",
      maxEntries: 4,
      targetPrice: center,
      allowEntry: trendDirection !== "UP",
      reason: "Downtrend: trade the recovery/pullback in trend direction.",
    };
  }

  // OVEREXTENDED
  return {
    state,
    scenario: "REVERSAL",
    direction: "NONE",
    maxEntries: 2,
    targetPrice: center,
    allowEntry: true,
    reason: "Overextended: reversal against the extreme, bounded by sequence and time controls.",
  };
}

function candleTouches(priceLow: number, priceHigh: number, level: number): boolean {
  return priceLow <= level && priceHigh >= level;
}

/**
 * Returns the FIRST planned band touched by this candle in the relevant zone.
 * One new entry maximum per candle. A touch never equals an immediate fill.
 */
export function detectBandTrigger(input: DynamicBandsInput): BandTrigger | null {
  const decision = scenarioDecision(input);
  if (!decision.allowEntry || decision.scenario === "NONE") return null;

  if (input.state === "BALANCED") {
    // Closest planned band first, because the supplied strategy treats each
    // band as an ordered planned entry and does not chase missed levels.
    for (let i = 0; i < 4; i += 1) {
      if (candleTouches(input.candleLow, input.candleHigh, input.lowerBands[i])) {
        return { bandIndex: (i + 1) as 1 | 2 | 3 | 4, triggerPrice: input.lowerBands[i], direction: "BUY" };
      }
      if (candleTouches(input.candleLow, input.candleHigh, input.upperBands[i])) {
        return { bandIndex: (i + 1) as 1 | 2 | 3 | 4, triggerPrice: input.upperBands[i], direction: "SELL" };
      }
    }
    return null;
  }

  if (input.state === "UPTREND") {
    for (let i = 0; i < 4; i += 1) {
      if (candleTouches(input.candleLow, input.candleHigh, input.lowerBands[i])) {
        return { bandIndex: (i + 1) as 1 | 2 | 3 | 4, triggerPrice: input.lowerBands[i], direction: "BUY" };
      }
    }
    return null;
  }

  if (input.state === "DOWNTREND") {
    for (let i = 0; i < 4; i += 1) {
      if (candleTouches(input.candleLow, input.candleHigh, input.upperBands[i])) {
        return { bandIndex: (i + 1) as 1 | 2 | 3 | 4, triggerPrice: input.upperBands[i], direction: "SELL" };
      }
    }
    return null;
  }

  // OVEREXTENDED: reversal. Direction is inferred from which side is extreme.
  // If both zones are touched in one candle, fail closed rather than guess.
  const lowerHit = input.lowerBands.findIndex((x) => candleTouches(input.candleLow, input.candleHigh, x));
  const upperHit = input.upperBands.findIndex((x) => candleTouches(input.candleLow, input.candleHigh, x));

  if (lowerHit >= 0 && upperHit >= 0) return null;
  if (upperHit >= 0) {
    return { bandIndex: (upperHit + 1) as 1 | 2 | 3 | 4, triggerPrice: input.upperBands[upperHit], direction: "SELL" };
  }
  if (lowerHit >= 0) {
    return { bandIndex: (lowerHit + 1) as 1 | 2 | 3 | 4, triggerPrice: input.lowerBands[lowerHit], direction: "BUY" };
  }
  return null;
}

export function confirmEntryAtCandleClose(trigger: BandTrigger, input: DynamicBandsInput): DynamicEntry {
  return {
    bandIndex: trigger.bandIndex,
    triggerPrice: trigger.triggerPrice,
    entryPrice: input.close,
    entryCandleTime: input.candleTime,
    direction: trigger.direction,
  };
}

export function canAddSequenceEntry(currentEntries: number, maxEntries: number, sameCandleEntryAlreadyCreated: boolean): boolean {
  if (sameCandleEntryAlreadyCreated) return false;
  if (currentEntries >= maxEntries) return false;
  return currentEntries < 4;
}

/**
 * Planned DCA sizing from the supplied strategy examples.
 * The function enforces sequence-level sizing and rejects arbitrary
 * per-entry risk multiplication.
 */
export function buildSequenceSizing(totalLots: number, maxEntries: 2 | 3 | 4): SequenceSizing {
  if (!Number.isFinite(totalLots) || totalLots <= 0) {
    throw new Error("totalLots must be > 0");
  }

  const proportions =
    maxEntries === 4 ? [0.10, 0.20, 0.30, 0.40] :
    maxEntries === 3 ? [0.20, 0.30, 0.50] :
    [0.40, 0.60];

  const trancheLots = proportions.map((p) => Number((totalLots * p).toFixed(8)));
  const sum = trancheLots.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - totalLots) > 1e-7) {
    trancheLots[trancheLots.length - 1] = Number((trancheLots.at(-1)! + (totalLots - sum)).toFixed(8));
  }

  return { totalLots, trancheLots, maxEntries };
}

export function sequenceExitReason(params: {
  targetTouched: boolean;
  timeLimitReached: boolean;
  lossLimitReached: boolean;
  profitTargetReached: boolean;
}): SequenceExitReason {
  if (params.targetTouched) return "TARGET_TOUCHED";
  if (params.timeLimitReached) return "TIME_LIMIT";
  if (params.lossLimitReached) return "LOSS_LIMIT";
  if (params.profitTargetReached) return "PROFIT_TARGET";
  return "NONE";
}

export const DYNAMIC_BANDS_SOURCE_DEFAULTS = {
  timeframe: "20m",
  source: "Close",
  period: 90,
  centerMaType: 1,
  bandMultipliers: [2, 2.5, 4, 5] as const,
  trendPeriod: 1000,
  trendMaType: 1,
  atrPeriod: 14,
  balancedAtrMultiple: 3,
  balancedDistancePips: 50,
  balancedDistancePercent: 0.5,
  overextendedAtrMultiple: 10,
  overextendedDistancePips: 150,
  overextendedDistancePercent: 1.5,
} as const;
