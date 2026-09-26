// QuantPilot — Modular Market Intelligence Service v0.2.0
// Additive Services: Whale Alerts, Macro Sentiment, Crypto Newsfeed.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.
//
// Jeder Fetcher ist unabhängig und fail-safe: wirft nie, gibt bei Fehlern ein
// degraded-Resultat zurück. Secrets sind optional — bei Fehlen wird graceful
// skipped, niemals geworfen.
//
// Secrets: WHALE_ALERT_API_KEY (optional).

export interface WhaleTransaction {
  hash: string;
  blockchain: string;
  symbol: string;
  amount_usd: number;
  amount: number;
  from: { owner?: string; owner_type?: string };
  to: { owner?: string; owner_type?: string };
  timestamp: number;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  published_at: number;
  categories: string[];
}

export interface MacroSentiment {
  fear_greed_index: number | null;
  fear_greed_classification: string | null;
  fetched_at: string;
}

export interface MarketIntelligenceResult {
  whale_alerts: {
    available: boolean;
    transactions: WhaleTransaction[];
    error: string | null;
  };
  macro_sentiment: MacroSentiment;
  newsfeed: {
    available: boolean;
    items: NewsItem[];
    error: string | null;
  };
  fetched_at: string;
}

async function fetchJson(url: string, headers: Record<string, string> = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const body = await res.text();
    let json: any = null;
    try { json = body ? JSON.parse(body) : null; } catch (_) { /* ignore */ }
    return { ok: res.ok, status: res.status, json, latency_ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: 0, json: null, latency_ms: Date.now() - t0, error: e?.message || 'fetch_failed' };
  } finally {
    clearTimeout(t);
  }
}

// ─── Whale Alerts ─────────────────────────────────────────────────────
// Whale Alert API v1: GET /v1/transactions?api_key=KEY&min=500000&start=...
// Free tier: 10 calls/min, min value $500k.
export async function fetchWhaleAlerts(
  secretsProvider: { get: (name: string) => string | undefined } | null,
  minUsd = 500000,
  limit = 25
): Promise<{ available: boolean; transactions: WhaleTransaction[]; error: string | null }> {
  if (!secretsProvider) return { available: false, transactions: [], error: 'no_secrets_provider' };
  const apiKey = secretsProvider.get('WHALE_ALERT_API_KEY');
  if (!apiKey) return { available: false, transactions: [], error: 'WHALE_ALERT_API_KEY not set (graceful skip)' };

  const start = Math.floor(Date.now() / 1000) - 3600; // letzte 1h
  const url = `https://api.whale-alert.io/v1/transactions?api_key=${apiKey}&min=${minUsd}&start=${start}&limit=${limit}`;
  const r = await fetchJson(url, { Accept: 'application/json' });
  if (!r.ok || !r.json?.result) {
    return { available: false, transactions: [], error: r.error || `HTTP ${r.status}` };
  }
  const transactions: WhaleTransaction[] = (r.json.result || []).map((t: any) => ({
    hash: t.hash || '',
    blockchain: t.blockchain || '',
    symbol: t.symbol || '',
    amount_usd: Number(t.amount_usd) || 0,
    amount: Number(t.amount) || 0,
    from: { owner: t.from?.owner, owner_type: t.from?.owner_type },
    to: { owner: t.to?.owner, owner_type: t.to?.owner_type },
    timestamp: Number(t.timestamp) || 0,
  }));
  return { available: true, transactions, error: null };
}

// ─── Macro Sentiment (Fear & Greed Index) ─────────────────────────────
// alternative.me — free, no key required.
export async function fetchMacroSentiment(): Promise<MacroSentiment> {
  const r = await fetchJson('https://api.alternative.me/fng/?limit=1', {}, 6000);
  const fetchedAt = new Date().toISOString();
  if (!r.ok || !r.json?.data?.length) {
    return { fear_greed_index: null, fear_greed_classification: null, fetched_at: fetchedAt };
  }
  const d = r.json.data[0];
  return {
    fear_greed_index: Number(d.value) || null,
    fear_greed_classification: d.value_classification || null,
    fetched_at: fetchedAt,
  };
}

// ─── Crypto Newsfeed ──────────────────────────────────────────────────
// CryptoCompare News API — free, no key required for basic news.
export async function fetchCryptoNews(limit = 20): Promise<{ available: boolean; items: NewsItem[]; error: string | null }> {
  const r = await fetchJson(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,Trading,Market&sortOrder=latest`, {}, 8000);
  if (!r.ok || !r.json?.Data) {
    return { available: false, items: [], error: r.error || `HTTP ${r.status}` };
  }
  const items: NewsItem[] = (r.json.Data || []).slice(0, limit).map((n: any) => ({
    id: String(n.id || ''),
    title: n.title || '',
    body: (n.body || '').slice(0, 280),
    url: n.url || '',
    source: n.source_info?.name || n.source || '',
    published_at: Number(n.published_on) || 0,
    categories: (n.categories || '').split('|').filter(Boolean),
  }));
  return { available: true, items, error: null };
}

// ─── Unified Fetch ────────────────────────────────────────────────────
export async function fetchMarketIntelligence(
  secretsProvider: { get: (name: string) => string | undefined } | null
): Promise<MarketIntelligenceResult> {
  const [whale, macro, news] = await Promise.all([
    fetchWhaleAlerts(secretsProvider),
    fetchMacroSentiment(),
    fetchCryptoNews(),
  ]);
  return {
    whale_alerts: whale,
    macro_sentiment: macro,
    newsfeed: news,
    fetched_at: new Date().toISOString(),
  };
}