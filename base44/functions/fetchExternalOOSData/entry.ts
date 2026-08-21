// QuantPilot — Phase 4: Independent OOS Data Acquisition
// Fetches XAUUSD M1 historical candles from an external reputable provider
// (Twelve Data or Alpha Vantage) to build a temporally independent OOS
// dataset beyond the MT5 100k limit.
//
// Data quality gate runs BEFORE any trade is computed.
// No synthetic candles, no duplication, no overlapping batches.
//
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { validateCandleData, toCompactCandles, type Candle } from '../../shared/forexDataQuality.ts';
import { fetchTwelveDataBatch, fmtDateTime, sleep, resolveApiKeyAndProvider, BATCH_SIZE, THROTTLE_MS } from '../../shared/twelveDataClient.ts';

const ALPHAVANTAGE_BASE = "https://www.alphavantage.co/query";
const MAX_BATCHES = 4; // 20k candles per call (rate-limit safe)

async function fetchAlphaVantageFull(apiKey: string): Promise<Candle[]> {
  const params = new URLSearchParams({
    function: "FX_INTRADAY",
    from_symbol: "XAU",
    to_symbol: "USD",
    interval: "1min",
    outputsize: "full",
    apikey: apiKey,
  });
  const url = `${ALPHAVANTAGE_BASE}?${params}`;
  const res = await fetch(url);
  const body = await res.json();

  if (body["Error Message"] || body.Note) {
    throw new Error(`Alpha Vantage error: ${body.Note || body["Error Message"]}`);
  }
  const key = "Time Series FX (1min)";
  if (!body[key]) throw new Error("Alpha Vantage: no time series in response");

  const series = body[key];
  return Object.entries(series).map(([dt, vals]: [string, any]) => ({
    time: Math.floor(new Date(dt.replace(" ", "T") + "Z").getTime() / 1000),
    open: parseFloat(vals["1. open"]),
    high: parseFloat(vals["2. high"]),
    low: parseFloat(vals["3. low"]),
    close: parseFloat(vals["4. close"]),
  })).filter((c: Candle) => isFinite(c.time)).sort((a, b) => a.time - b.time);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { apiKey, provider } = resolveApiKeyAndProvider(
      secrets.get("FOREX_DATA_API_KEY"),
      secrets.get("FOREX_DATA_PROVIDER")
    );

    if (!apiKey) {
      return Response.json({
        oos_data_available: false,
        status: "NO_API_KEY",
        error: "FOREX_DATA_API_KEY not set. Cannot acquire independent OOS data.",
        provider,
      });
    }

    const body = await req.json().catch(() => ({}));
    const endDateInput = body.end_date || null; // ISO datetime for pagination
    const maxBatches = Math.min(body.max_batches || MAX_BATCHES, 6);
    const discoveryRange = body.discovery_range || null; // { start: unix, end: unix } for overlap check

    let allCandles: Candle[] = [];
    let sourceInfo: any = { provider, symbol: "XAU/USD", timeframe: "M1" };

    if (provider === "twelvedata") {
      let cursor = endDateInput;
      for (let b = 0; b < maxBatches; b++) {
        const batch = await fetchTwelveDataBatch(apiKey, cursor);
        if (batch.length === 0) break;
        allCandles.push(...batch);
        // Next cursor = oldest candle in this batch minus 1 second
        cursor = fmtDateTime(batch[0].time - 1);
        if (b < maxBatches - 1) await sleep(THROTTLE_MS);
      }
    } else if (provider === "alphavantage") {
      allCandles = await fetchAlphaVantageFull(apiKey);
    } else {
      return Response.json({
        oos_data_available: false,
        status: "UNKNOWN_PROVIDER",
        error: `Unsupported provider: ${provider}. Use 'twelvedata' or 'alphavantage'.`,
      });
    }

    // ── Deduplicate + sort ────────────────────────────────────────────
    const seen = new Set<number>();
    const deduped: Candle[] = [];
    for (const c of allCandles) {
      if (!seen.has(c.time)) { seen.add(c.time); deduped.push(c); }
    }
    deduped.sort((a, b) => a.time - b.time);

    // ── Data quality gate (with symbol/timeframe/overlap checks) ──────
    const quality = validateCandleData(deduped, {
      expectedSymbol: "XAUUSD",
      expectedTimeframe: "M1",
      discoveryRange,
      minCandles: 30000,
    });

    sourceInfo.date_range = {
      start: quality.oldest_candle ? new Date(quality.oldest_candle * 1000).toISOString() : null,
      end: quality.newest_candle ? new Date(quality.newest_candle * 1000).toISOString() : null,
    };
    sourceInfo.timestamp_format = "unix_seconds";
    sourceInfo.timezone = "UTC";
    sourceInfo.feed = provider === "twelvedata" ? "Twelve Data XAU/USD" : "Alpha Vantage XAU/USD";

    return Response.json({
      oos_data_available: quality.pass,
      status: quality.pass ? "OK" : "QUALITY_GATE_FAILED",
      source: sourceInfo,
      candle_count: deduped.length,
      data_quality: quality,
      candles: toCompactCandles(deduped),
    });
  } catch (error) {
    // Detect provider auth errors → deterministic PROVIDER_AUTH_INVALID
    // Sanitize: API key must NEVER appear in logs, responses, or exceptions
    const rawMsg = error.message || "";
    const msg = rawMsg.replace(/apikey=[^\s&"']+/gi, "apikey=***REDACTED***")
                      .replace(/api_key=[^\s&"']+/gi, "api_key=***REDACTED***");
    const isAuthError = msg.includes("apikey") || msg.includes("API key") ||
                        msg.includes("incorrect") || msg.includes("unauthorized") ||
                        msg.includes("Invalid API") || msg.includes("401");
    return Response.json({
      oos_data_available: false,
      status: isAuthError ? "PROVIDER_AUTH_INVALID" : "ERROR",
      error: isAuthError ? "Provider credentials invalid or rejected" : msg,
    }, { status: isAuthError ? 401 : 500 });
  }
}