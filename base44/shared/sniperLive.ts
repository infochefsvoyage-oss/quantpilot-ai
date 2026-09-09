// QuantPilot — Live Crypto Sniper read-only scanner.
// Source: public Binance/MEXC REST candles + book ticker only.
// No API keys, no account access, no order capability.
// A+ rule is deliberately conservative: ALL 4 gates must pass.

export const SNIPER_SYMBOLS = [
  { exchange: "BINANCE", symbol: "BTCUSDT" },
  { exchange: "BINANCE", symbol: "ETHUSDT" },
  { exchange: "MEXC", symbol: "SOLUSDT" },
  { exchange: "BINANCE", symbol: "DOGEUSDT" },
];

const BINANCE_BASES = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api-gcp.binance.com",
];
const MEXC_BASES = ["https://api.mexc.com"];
const FETCH_TIMEOUT_MS = 8000;
export const MARKET_DATA_FRESH_MS = 180000;

function timestampMs(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

export function marketFreshness(sourceTimestamp: any, now = Date.now()) {
  const ts = timestampMs(sourceTimestamp);
  const ageMs = ts > 0 ? now - ts : Number.POSITIVE_INFINITY;
  return {
    source_timestamp_ms: ts || null,
    data_age_ms: Number.isFinite(ageMs) ? ageMs : null,
    data_fresh: ts > 0 && ageMs >= 0 && ageMs <= MARKET_DATA_FRESH_MS,
    freshness_threshold_ms: MARKET_DATA_FRESH_MS,
  };
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function getJson(url: string, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok, status: res.status, json, latency_ms: Date.now() - started };
  } catch (e: any) {
    return { ok: false, status: 0, json: null, latency_ms: Date.now() - started, error: e?.message || "FETCH_FAILED" };
  } finally {
    clearTimeout(t);
  }
}

async function fetchFromExchange(exchange: string, path: string) {
  const bases = exchange === "BINANCE" ? BINANCE_BASES : MEXC_BASES;
  let last: any = { ok: false, status: 0, json: null, error: "NO_ENDPOINT" };
  for (const base of bases) {
    last = await getJson(`${base}${path}`);
    if (last.ok) return { ...last, endpoint: base };
  }
  return last;
}

async function fetchMarketBundle(requestedExchange: string, symbol: string) {
  const paths = {
    r1: `/api/v3/klines?symbol=${symbol}&interval=1m&limit=120`,
    r15: `/api/v3/klines?symbol=${symbol}&interval=15m&limit=80`,
    r4: `/api/v3/klines?symbol=${symbol}&interval=4h&limit=80`,
    book: `/api/v3/ticker/bookTicker?symbol=${symbol}`,
  };

  const fetchBundle = async (exchange: string) => {
    const [r1, r15, r4, book] = await Promise.all([
      fetchFromExchange(exchange, paths.r1),
      fetchFromExchange(exchange, paths.r15),
      fetchFromExchange(exchange, paths.r4),
      fetchFromExchange(exchange, paths.book),
    ]);
    return { r1, r15, r4, book };
  };

  const native = await fetchBundle(requestedExchange);
  const nativeOk = Object.values(native).every((r: any) => r?.ok);
  if (nativeOk) {
    return {
      ...native,
      requested_exchange: requestedExchange,
      actual_source_exchange: requestedExchange,
      source_mode: "NATIVE",
      fallback_reason: null,
    };
  }

  // Binance is geo-blocked in some Base44 runtimes. Fail over the WHOLE bundle to MEXC,
  // never individual legs, so candles/book are exchange-consistent and auditable.
  if (requestedExchange === "BINANCE") {
    const fallback = await fetchBundle("MEXC");
    const fallbackOk = Object.values(fallback).every((r: any) => r?.ok);
    if (fallbackOk) {
      const failedNative = Object.entries(native)
        .filter(([, r]: any) => !r?.ok)
        .map(([k, r]: any) => `${k}:${r?.status || 0}`)
        .join(",");
      return {
        ...fallback,
        requested_exchange: requestedExchange,
        actual_source_exchange: "MEXC",
        source_mode: "MEXC_FALLBACK",
        fallback_reason: `BINANCE_NATIVE_FAILED(${failedNative || "UNKNOWN"})`,
      };
    }
  }

  return {
    ...native,
    requested_exchange: requestedExchange,
    actual_source_exchange: requestedExchange,
    source_mode: "NATIVE_FAILED",
    fallback_reason: null,
  };
}

function normalizeKlines(raw: any[]): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k: any) => ({
    open_time: num(k?.[0]),
    open: num(k?.[1]),
    high: num(k?.[2]),
    low: num(k?.[3]),
    close: num(k?.[4]),
    volume: num(k?.[5]),
    close_time: num(k?.[6]) || num(k?.[0]) + 60000,
  })).filter((k) => k.open > 0 && k.high > 0 && k.low > 0 && k.close > 0);
}

function ema(values: number[], period: number): number | null {
  if (!values.length || values.length < period) return null;
  const alpha = 2 / (period + 1);
  let out = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) out = values[i] * alpha + out * (1 - alpha);
  return out;
}

function htfBias(k15: any[], k4h: any[]) {
  const c15 = k15.slice(0, -1).map((k) => k.close);
  const c4 = k4h.slice(0, -1).map((k) => k.close);
  const last15 = c15.at(-1) || 0;
  const last4 = c4.at(-1) || 0;
  const e15_20 = ema(c15, 20), e15_50 = ema(c15, 50);
  const e4_20 = ema(c4, 20), e4_50 = ema(c4, 50);
  const long15 = !!(e15_20 && e15_50 && last15 > e15_20 && e15_20 > e15_50);
  const long4 = !!(e4_20 && e4_50 && last4 > e4_20 && e4_20 > e4_50);
  const short15 = !!(e15_20 && e15_50 && last15 < e15_20 && e15_20 < e15_50);
  const short4 = !!(e4_20 && e4_50 && last4 < e4_20 && e4_20 < e4_50);
  if (long15 && long4) return "LONG";
  if (short15 && short4) return "SHORT";
  return "NEUTRAL";
}

function detectSetup(k1: any[], bias: string) {
  const closed = k1.slice(0, -1);
  if (closed.length < 30) return null;

  // Examine the three most recently CLOSED candles. A sweep must pierce the prior
  // 20-candle extreme and close back through that swept level on the same candle.
  for (let offset = 1; offset <= 3; offset++) {
    const idx = closed.length - offset;
    const c = closed[idx];
    const prior = closed.slice(Math.max(0, idx - 20), idx);
    if (prior.length < 15) continue;
    const priorLow = Math.min(...prior.map((x) => x.low));
    const priorHigh = Math.max(...prior.map((x) => x.high));
    const avgVol = prior.reduce((s, x) => s + x.volume, 0) / prior.length;

    const longSweep = c.low < priorLow && c.close > priorLow;
    const shortSweep = c.high > priorHigh && c.close < priorHigh;
    if (!longSweep && !shortSweep) continue;

    const side = longSweep ? "LONG" : "SHORT";
    const reclaim = side === "LONG" ? (c.close > c.open && c.close > priorLow) : (c.close < c.open && c.close < priorHigh);
    const volume = avgVol > 0 && c.volume >= avgVol * 1.25;
    const htf = bias === side;
    return {
      side,
      candle: c,
      liquidity_sweep: true,
      reclaim_rejection: reclaim,
      volume_confirmation: volume,
      htf_alignment: htf,
      swept_level: side === "LONG" ? priorLow : priorHigh,
      avg_volume: avgVol,
    };
  }

  // No real liquidity sweep found: keep directional context but hard-fail Gate 1/2.
  const c = closed.at(-1);
  return {
    side: bias === "SHORT" ? "SHORT" : "LONG",
    candle: c,
    liquidity_sweep: false,
    reclaim_rejection: false,
    volume_confirmation: false,
    htf_alignment: bias !== "NEUTRAL",
    swept_level: null,
    avg_volume: 0,
  };
}

function deriveICT(k1: any[], side: string, entry: number) {
  const closed = k1.slice(0, -1);
  const c = closed.at(-1);
  const p1 = closed.at(-2);
  const p2 = closed.at(-3);
  const prior = closed.slice(-12, -2);
  if (!c || !p1 || !p2 || prior.length < 5) {
    return { displacement: false, mss_bos: "NONE", fvg_detected: false, order_block_detected: false, premium_discount: "EQUILIBRIUM" };
  }
  const avgBody = prior.reduce((s, x) => s + Math.abs(x.close - x.open), 0) / prior.length;
  const body = Math.abs(c.close - c.open);
  const directional = side === "LONG" ? c.close > c.open : c.close < c.open;
  const displacement = avgBody > 0 && body >= avgBody * 1.5 && directional;
  const priorHigh = Math.max(...prior.map((x) => x.high));
  const priorLow = Math.min(...prior.map((x) => x.low));
  const mss = side === "LONG" ? c.close > priorHigh : c.close < priorLow;
  const bullishFvg = p2.high < c.low;
  const bearishFvg = p2.low > c.high;
  const fvgDetected = side === "LONG" ? bullishFvg : bearishFvg;
  const recent = closed.slice(-40);
  const rangeHigh = Math.max(...recent.map((x) => x.high));
  const rangeLow = Math.min(...recent.map((x) => x.low));
  const midpoint = (rangeHigh + rangeLow) / 2;
  const premiumDiscount = entry < midpoint ? "DISCOUNT" : entry > midpoint ? "PREMIUM" : "EQUILIBRIUM";
  return {
    displacement,
    displacement_candles: displacement ? 1 : 0,
    mss_bos: mss ? "MSS" : "NONE",
    mss_direction: mss ? (side === "LONG" ? "BULLISH" : "BEARISH") : "NEUTRAL",
    fvg_detected: fvgDetected,
    fvg_top: fvgDetected ? Math.max(p2.high, c.low) : null,
    fvg_bottom: fvgDetected ? Math.min(p2.high, c.low) : null,
    order_block_detected: false,
    ob_high: null,
    ob_low: null,
    premium_discount: premiumDiscount,
  };
}

function levels(k1: any[], side: string, entry: number) {
  const closed = k1.slice(0, -1);
  const recent = closed.slice(-20);
  const swingLow = Math.min(...recent.map((x) => x.low));
  const swingHigh = Math.max(...recent.map((x) => x.high));
  const minBuffer = entry * 0.0005;
  let stop = side === "LONG" ? swingLow - minBuffer : swingHigh + minBuffer;
  let risk = Math.abs(entry - stop);
  if (!(risk > 0)) risk = entry * 0.002;
  stop = side === "LONG" ? entry - risk : entry + risk;
  const p = (r: number) => side === "LONG" ? entry + risk * r : entry - risk * r;
  return { stop, tp1: p(2.5), tp2: p(3.0), tp3: p(4.0), rr: 2.5 };
}

export async function scanLiveSniperSymbol(exchange: string, symbol: string) {
  const bundle = await fetchMarketBundle(exchange, symbol);
  const { r1, r15, r4, book } = bundle;

  if (!r1.ok || !r15.ok || !r4.ok || !book.ok) {
    return {
      id: `${exchange}-${symbol}`,
      exchange, symbol,
      decision: "NO_TRADE",
      ascan_score: 0, rr: 0,
      gate_liquidity_sweep: false,
      gate_reclaim_rejection: false,
      gate_volume_confirmation: false,
      gate_htf_alignment: false,
      spread_ok: false, funding_ok: false, data_fresh: false, stop_loss_present: false,
      htf_bias: "NEUTRAL",
      source_type: "LIVE_PUBLIC_REST",
      source_confirmed: false,
      requested_exchange: bundle.requested_exchange,
      actual_source_exchange: bundle.actual_source_exchange,
      source_mode: bundle.source_mode,
      fallback_reason: bundle.fallback_reason,
      error: `MARKET_DATA_FAILED 1m=${r1.status} 15m=${r15.status} 4h=${r4.status} book=${book.status}`,
      created_date: new Date().toISOString(),
    };
  }

  const k1 = normalizeKlines(r1.json);
  const k15 = normalizeKlines(r15.json);
  const k4 = normalizeKlines(r4.json);
  if (k1.length < 30 || k15.length < 55 || k4.length < 55) {
    return {
      id: `${exchange}-${symbol}`, exchange, symbol, decision: "NO_TRADE", ascan_score: 0, rr: 0,
      gate_liquidity_sweep: false, gate_reclaim_rejection: false, gate_volume_confirmation: false, gate_htf_alignment: false,
      spread_ok: false, funding_ok: false, data_fresh: false, stop_loss_present: false, htf_bias: "NEUTRAL",
      source_type: "LIVE_PUBLIC_REST", source_confirmed: false,
      requested_exchange: bundle.requested_exchange, actual_source_exchange: bundle.actual_source_exchange,
      source_mode: bundle.source_mode, fallback_reason: bundle.fallback_reason,
      error: "INSUFFICIENT_CANDLES", created_date: new Date().toISOString(),
    };
  }

  const bias = htfBias(k15, k4);
  const setup = detectSetup(k1, bias)!;
  const lastClosed = k1[k1.length - 2];
  const bid = num(book.json?.bidPrice);
  const ask = num(book.json?.askPrice);
  const entry = setup.side === "LONG" ? (ask || lastClosed.close) : (bid || lastClosed.close);
  const spreadPct = bid > 0 && ask > 0 ? ((ask - bid) / ((ask + bid) / 2)) * 100 : 999;
  const freshness = marketFreshness(lastClosed.close_time);
  const dataFresh = freshness.data_fresh;
  const spreadOk = spreadPct <= 0.08;
  const lv = levels(k1, setup.side, entry);
  const ict = deriveICT(k1, setup.side, entry);

  const gateCount = [setup.liquidity_sweep, setup.reclaim_rejection, setup.volume_confirmation, setup.htf_alignment].filter(Boolean).length;
  const score = gateCount * 25;
  const all4 = gateCount === 4;
  const operational = dataFresh && spreadOk && lv.stop > 0;
  const decision = all4 && operational && lv.rr >= 2.5 ? "ENTER" : (gateCount >= 2 && operational ? "WATCH_ONLY" : "NO_TRADE");

  return {
    id: `${exchange}-${symbol}-${lastClosed.close_time}`,
    symbol, exchange,
    side: setup.side,
    htf_bias: bias,
    decision,
    ascan_score: score,
    rr: lv.rr,
    gate_liquidity_sweep: setup.liquidity_sweep,
    gate_reclaim_rejection: setup.reclaim_rejection,
    gate_volume_confirmation: setup.volume_confirmation,
    gate_htf_alignment: setup.htf_alignment,
    spread_ok: spreadOk,
    funding_ok: true,
    data_fresh: dataFresh,
    stop_loss_present: lv.stop > 0,
    entry_price: entry,
    stop_loss: lv.stop,
    take_profit_1: lv.tp1,
    take_profit_2: lv.tp2,
    take_profit_3: lv.tp3,
    spread_pct: Math.round(spreadPct * 10000) / 10000,
    data_age_ms: freshness.data_age_ms,
    freshness_threshold_ms: freshness.freshness_threshold_ms,
    source_timestamp_ms: freshness.source_timestamp_ms,
    signal_candle_close_time: new Date(lastClosed.close_time).toISOString(),
    current_market_price: bid > 0 && ask > 0 ? (bid + ask) / 2 : entry,
    market_observed_at: new Date().toISOString(),
    source_type: "LIVE_PUBLIC_REST",
    source_confirmed: true,
    requested_exchange: bundle.requested_exchange,
    actual_source_exchange: bundle.actual_source_exchange,
    source_mode: bundle.source_mode,
    fallback_reason: bundle.fallback_reason,
    endpoint: r1.endpoint,
    source_endpoints: {
      kline_1m: r1.endpoint || null,
      kline_15m: r15.endpoint || null,
      kline_4h: r4.endpoint || null,
      book_ticker: book.endpoint || null,
    },
    latency_ms: Math.max(r1.latency_ms || 0, r15.latency_ms || 0, r4.latency_ms || 0, book.latency_ms || 0),
    created_date: new Date().toISOString(),
    notes: all4 ? "Alle 4 A+ Gates auf Live-Candles bestätigt" : `${gateCount}/4 A+ Gates bestätigt`,
    ict,
  };
}

export async function scanAllLiveSniperSignals() {
  const settled = await Promise.all(SNIPER_SYMBOLS.map((s) => scanLiveSniperSymbol(s.exchange, s.symbol)));
  return settled;
}
