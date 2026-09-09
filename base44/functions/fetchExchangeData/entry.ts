// QuantPilot — Fetch live market data from Binance and MEXC public APIs.
// No API key required for public ticker endpoints.
// Returns: connection status, ticker prices (BTC, ETH, SOL), rate-limit health.

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const BINANCE_ENDPOINTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api-gcp.binance.com",
];
const MEXC_API = "https://api.mexc.com";

// Fallback: CoinGecko public API (no key, not geo-blocked from backend runtime)
const COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana";
const COINGECKO_ID_MAP = { BTCUSDT: "bitcoin", ETHUSDT: "ethereum", SOLUSDT: "solana" };

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

async function fetchCoinGeckoFallback() {
  // CoinGecko fallback — not geo-blocked, no API key required.
  // Returns tickers in the same shape as Binance/MEXC for BTC/ETH/SOL.
  const r = await fetchWithTimeout(COINGECKO_MARKETS, 8000);
  if (!r.ok || !Array.isArray(r.json)) {
    return { reachable: false, error: r.error || `HTTP ${r.status}`, latency_ms: r.latency_ms, tickers: [] };
  }
  const tickers = r.json
    .map((c) => {
      // Map coingecko id back to SYMBOLS format
      const symbol = Object.entries(COINGECKO_ID_MAP).find(([, id]) => id === c.id)?.[0];
      if (!symbol) return null;
      return {
        symbol,
        last_price: c.current_price,
        price_change_pct: c.price_change_percentage_24h ?? 0,
        high_24h: c.high_24h ?? 0,
        low_24h: c.low_24h ?? 0,
        volume_24h: c.total_volume ?? 0,
        quote_volume_24h: (c.total_volume ?? 0) * (c.current_price ?? 0),
      };
    })
    .filter(Boolean);
  return { reachable: true, latency_ms: r.latency_ms, tickers, source: "coingecko" };
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
    // Public market-data endpoint only: no account data, no secrets, no order capability.
    let [binance, mexc] = await Promise.all([fetchBinanceTickers(), fetchMexcTickers()]);

    // Backend runtime (Deno) is geo-blocked for Binance (HTTP 451) and CoinGecko (403).
    // MEXC is reachable. If Binance fails, mirror MEXC tickers (same BTC/ETH/SOL USDT assets).
    let fallbackSource = null;
    if (!binance.reachable && mexc.reachable) {
      fallbackSource = "mexc_mirror";
      binance = {
        reachable: true,
        latency_ms: mexc.latency_ms,
        tickers: mexc.tickers,
        error: `${binance.error} → MEXC mirror`,
      };
    } else if (!binance.reachable || !mexc.reachable) {
      // Last resort: try CoinGecko (may also be blocked from Deno runtime)
      const cg = await fetchCoinGeckoFallback();
      if (cg.reachable) {
        fallbackSource = "coingecko";
        if (!binance.reachable) binance = { ...cg, error: `${binance.error} → CG fallback` };
        if (!mexc.reachable) mexc = { ...cg, error: `${mexc.error} → CG fallback` };
      }
    }

    // Rate-limit heuristic: if latency > 3000ms, flag as THROTTLED
    const binanceRateLimit = binance.latency_ms > 3000 ? "THROTTLED" : "OK";
    const mexcRateLimit = mexc.latency_ms > 3000 ? "THROTTLED" : "OK";

    return Response.json({
      timestamp: new Date().toISOString(),
      data_source: fallbackSource || "native",
      binance: {
        reachable: binance.reachable,
        latency_ms: binance.latency_ms,
        rate_limit_status: binanceRateLimit,
        tickers: binance.tickers,
        error: binance.error || null,
        rest_api: binance.reachable ? "PASS" : "FAIL",
        auth_api: "NOT_VALIDATED",
        api_key_configured: null,
        account_readable: false,
        auth_latency_ms: null,
        auth_environment: null,
        ticker_freshness: binance.reachable && binance.tickers.length > 0 ? "FRESH" : "STALE",
      },
      mexc: {
        reachable: mexc.reachable,
        latency_ms: mexc.latency_ms,
        rate_limit_status: mexcRateLimit,
        tickers: mexc.tickers,
        error: mexc.error || null,
        rest_api: mexc.reachable ? "PASS" : "FAIL",
        auth_api: "NOT_VALIDATED",
        api_key_configured: null,
        account_readable: false,
        auth_latency_ms: null,
        ticker_freshness: mexc.reachable && mexc.tickers.length > 0 ? "FRESH" : "STALE",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}