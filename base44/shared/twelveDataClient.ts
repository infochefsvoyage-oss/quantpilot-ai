// Shared Twelve Data client — imported by fetchExternalOOSData and runPhase4OOSValidation.
// Plain module: exports only, no Deno.serve.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const TWELVEDATA_BASE = "https://api.twelvedata.com/time_series";
export const BATCH_SIZE = 5000;
export const THROTTLE_MS = 8000;

export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export function fmtDateTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

export async function fetchTwelveDataBatch(apiKey: string, endDate: string | null): Promise<Candle[]> {
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

// Resolve API key: prefer URL-embedded key from FOREX_DATA_PROVIDER over FOREX_DATA_API_KEY.
export function resolveApiKeyAndProvider(apiKeyRaw: string | undefined, providerRaw: string | undefined): { apiKey: string | undefined; provider: string } {
  let apiKey = apiKeyRaw;
  let provider = (providerRaw || "twelvedata").toLowerCase();
  if (provider.includes("twelvedata.com")) {
    const keyMatch = provider.match(/[?&]apikey=([^&]+)/);
    if (keyMatch) apiKey = keyMatch[1];
    provider = "twelvedata";
  } else if (provider.includes("alphavantage")) {
    const keyMatch = provider.match(/[?&]apikey=([^&]+)/);
    if (keyMatch) apiKey = keyMatch[1];
    provider = "alphavantage";
  }
  return { apiKey, provider: provider === "alphavantage" ? "alphavantage" : "twelvedata" };
}