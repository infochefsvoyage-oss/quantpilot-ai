// QuantPilot — Fetch live market data from Binance and MEXC public APIs.
// No API key required for public ticker endpoints.
// Returns: connection status, ticker prices (BTC, ETH, SOL), rate-limit health.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const BINANCE_ENDPOINTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api-gcp.binance.com",
];
const MEXC_API = "https://api.mexc.com";

async function fetchWithTimeout(url, timeoutMs = 8000, extraHeaders: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "Accept": "application/json", ...extraHeaders } });
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

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateBinanceAuth() {
  const apiKey = secrets.get("BINANCE_API_KEY");
  const apiSecret = secrets.get("BINANCE_API_SECRET");
  if (!apiKey || !apiSecret) return { configured: false, status: "NOT_CONFIGURED", account_readable: false };

  const configuredBase = secrets.get("BINANCE_AUTH_BASE_URL");
  const bases = configuredBase ? [configuredBase] : ["https://testnet.binance.vision", "https://api.binance.com"];
  for (const baseRaw of bases) {
    const base = baseRaw.replace(/\/+$/, "");
    const qs = `timestamp=${Date.now()}&recvWindow=5000`;
    const signature = await hmacSha256Hex(apiSecret, qs);
    const r = await fetchWithTimeout(`${base}/api/v3/account?${qs}&signature=${signature}`, 8000, { "X-MBX-APIKEY": apiKey });
    if (r.ok && r.json && typeof r.json === "object") {
      return { configured: true, status: "PASS", account_readable: true, latency_ms: r.latency_ms, environment: base.includes("testnet") ? "TESTNET" : "LIVE", can_trade: r.json.canTrade === true };
    }
  }
  return { configured: true, status: "FAIL", account_readable: false };
}

async function validateMexcAuth() {
  const apiKey = secrets.get("MEXC_API_KEY");
  const apiSecret = secrets.get("MEXC_API_SECRET");
  if (!apiKey || !apiSecret) return { configured: false, status: "NOT_CONFIGURED", account_readable: false };

  const qs = `timestamp=${Date.now()}&recvWindow=5000`;
  const signature = await hmacSha256Hex(apiSecret, qs);
  const r = await fetchWithTimeout(`${MEXC_API}/api/v3/account?${qs}&signature=${signature}`, 8000, { "X-MEXC-APIKEY": apiKey });
  if (r.ok && r.json && typeof r.json === "object") {
    return { configured: true, status: "PASS", account_readable: true, latency_ms: r.latency_ms, can_trade: r.json.canTrade === true };
  }
  return { configured: true, status: "FAIL", account_readable: false, http_status: r.status };
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

    const [binance, mexc, binanceAuth, mexcAuth] = await Promise.all([
      fetchBinanceTickers(),
      fetchMexcTickers(),
      validateBinanceAuth(),
      validateMexcAuth(),
    ]);

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
        rest_api: binance.reachable ? "PASS" : "FAIL",
        auth_api: binanceAuth.status,
        api_key_configured: binanceAuth.configured,
        account_readable: binanceAuth.account_readable,
        auth_latency_ms: binanceAuth.latency_ms ?? null,
        auth_environment: binanceAuth.environment ?? null,
        ticker_freshness: binance.reachable && binance.tickers.length > 0 ? "FRESH" : "STALE",
      },
      mexc: {
        reachable: mexc.reachable,
        latency_ms: mexc.latency_ms,
        rate_limit_status: mexcRateLimit,
        tickers: mexc.tickers,
        error: mexc.error || null,
        rest_api: mexc.reachable ? "PASS" : "FAIL",
        auth_api: mexcAuth.status,
        api_key_configured: mexcAuth.configured,
        account_readable: mexcAuth.account_readable,
        auth_latency_ms: mexcAuth.latency_ms ?? null,
        ticker_freshness: mexc.reachable && mexc.tickers.length > 0 ? "FRESH" : "STALE",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}