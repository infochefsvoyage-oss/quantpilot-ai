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

const TWELVEDATA_BASE = "https://api.twelvedata.com/time_series";
const ALPHAVANTAGE_BASE = "https://www.alphavantage.co/query";
const BATCH_SIZE = 5000;
const MAX_BATCHES = 4; // 20k candles per call (rate-limit safe)
const THROTTLE_MS = 8000; // Twelve Data free: 8 req/min

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fmtDateTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

async function fetchTwelveDataBatch(apiKey: string, endDate: string | null): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol: "XAU/USD",
    interval: "1min",
    outputsize: String(BATCH_SIZE),
    apikey: apiKey,
    format: "JSON",
  });
  if (endDate) params.set("end_date", endDate);

  const url = `${TWELVEDATA_BASE}?${params}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  const body = await res.json();

  if (body.status === "error") {
    throw new Error(`Twelve Data error: ${body.message || body.code || "unknown"}`);
  }
  if (!body.values || !Array.isArray(body.values)) {
    throw new Error("Twelve Data: unexpected response format");
  }

  // values are most-recent-first; convert to chronological order
  return body.values
    .map((v: any) => ({
      time: Math.floor(new Date(v.datetime + " UTC").getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
    }))
    .filter((c: Candle) => isFinite(c.time) && isFinite(c.open))
    .sort((a: Candle, b: Candle) => a.time - b.time);
}

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

    let apiKey = secrets.get("FOREX_DATA_API_KEY");
    let providerRaw = (secrets.get("FOREX_DATA_PROVIDER") || "twelvedata").toLowerCase();

    // Handle edge case: provider secret contains a full URL with embedded apikey
    if (providerRaw.includes("twelvedata.com")) {
      const keyMatch = providerRaw.match(/[?&]apikey=([^&]+)/);
      if (keyMatch && !apiKey) apiKey = keyMatch[1];
      providerRaw = "twelvedata";
    } else if (providerRaw.includes("alphavantage")) {
      const keyMatch = providerRaw.match(/[?&]apikey=([^&]+)/);
      if (keyMatch && !apiKey) apiKey = keyMatch[1];
      providerRaw = "alphavantage";
    }

    const provider = providerRaw === "alphavantage" ? "alphavantage" : "twelvedata";

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

    // ── Data quality gate ──────────────────────────────────────────────
    const quality = validateCandleData(deduped);

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
    return Response.json({
      oos_data_available: false,
      status: "ERROR",
      error: error.message,
    }, { status: 500 });
  }
}