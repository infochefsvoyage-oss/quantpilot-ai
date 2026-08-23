// QuantPilot — Fetch live market data from Binance and MEXC public APIs.
// No API key required for public ticker endpoints.
// Returns: connection status, ticker prices (BTC, ETH, SOL), rate-limit health.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const BINANCE_ENDPOINTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api-gcp.binance.com",
];
const MEXC_API = "https://api.mexc.com";

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "Accept": "application/json" } });
    const body = await res.text();
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, json: null, latency_ms: Date.now() - t0, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

async function fetchBinanceTickers() {
  // Try multiple Binance endpoints — some are geo-blocked (HTTP 451)
  let r = { ok: false, status: 0, json: null, latency_ms: 0, error: "no_endpoints_tried" };
  for (const base of BINANCE_ENDPOINTS) {
    r = await fetchWithTimeout(`${base}/api/v3/ticker/24hr`);
    if (r.ok && Array.isArray(r.json)) break;
  }
  if (!r.ok || !Array.isArray(r.json)) {
    return { reachable: false, error: r.error || `HTTP ${r.status}`, latency_ms: r.latency_ms, tickers: [] };
  }
  const tickers = r.json
    .filter((t) => SYMBOLS.includes(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      last_price: parseFloat(t.lastPrice),
      price_change_pct: parseFloat(t.priceChangePercent),
      high_24h: parseFloat(t.highPrice),
      low_24h: parseFloat(t.lowPrice),
      volume_24h: parseFloat(t.volume),
      quote_volume_24h: parseFloat(t.quoteVolume),
    }));
  return { reachable: true, latency_ms: r.latency_ms, tickers };
}

async function fetchMexcTickers() {
  // MEXC: /api/v3/ticker/24hr returns array of all symbols
  const r = await fetchWithTimeout(`${MEXC_API}/api/v3/ticker/24hr`);
  if (!r.ok || !Array.isArray(r.json)) {
    return { reachable: false, error: r.error || `HTTP ${r.status}`, latency_ms: r.latency_ms, tickers: [] };
  }
  const tickers = r.json
    .filter((t) => SYMBOLS.includes(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      last_price: parseFloat(t.lastPrice),
      price_change_pct: parseFloat(t.priceChangePercent),
      high_24h: parseFloat(t.highPrice),
      low_24h: parseFloat(t.lowPrice),
      volume_24h: parseFloat(t.volume),
      quote_volume_24h: parseFloat(t.quoteVolume),
    }));
  return { reachable: true, latency_ms: r.latency_ms, tickers };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [binance, mexc] = await Promise.all([fetchBinanceTickers(), fetchMexcTickers()]);

    // Rate-limit heuristic: if latency > 3000ms, flag as THROTTLED
    const binanceRateLimit = binance.latency_ms > 3000 ? "THROTTLED" : "OK";
    const mexcRateLimit = mexc.latency_ms > 3000 ? "THROTTLED" : "OK";

    return Response.json({
      timestamp: new Date().toISOString(),
      binance: {
        reachable: binance.reachable,
        latency_ms: binance.latency_ms,
        rate_limit_status: binanceRateLimit,
        tickers: binance.tickers,
        error: binance.error || null,
      },
      mexc: {
        reachable: mexc.reachable,
        latency_ms: mexc.latency_ms,
        rate_limit_status: mexcRateLimit,
        tickers: mexc.tickers,
        error: mexc.error || null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}