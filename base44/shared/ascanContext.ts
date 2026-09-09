// QuantPilot — ASCAN contextual intelligence sources (READ ONLY, additive only).
// IMPORTANT: This module never changes the 4-Gate A+ execution decision.
// Sources: MEXC Futures derivatives, FRED macro, CFTC COT, GDELT news, optional Dune on-chain.

const TIMEOUT = 20000;
const MEXC_CONTRACT = 'https://contract.mexc.com';
const CFTC_TFF = 'https://www.cftc.gov/dea/newcot/FinFutWk.txt';
const FRED_DFF = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF';
const FRED_DGS10 = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10';
const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

function env(name: string): string | null {
  try {
    // Base44 server functions run in a Deno-compatible environment.
    // @ts-ignore
    if (typeof Deno !== 'undefined') return Deno.env.get(name) || null;
  } catch {}
  try {
    // @ts-ignore
    return typeof process !== 'undefined' ? process.env?.[name] || null : null;
  } catch {}
  return null;
}

async function fetchText(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  const started = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': 'QuantPilot/1.0', Accept: '*/*', ...(init.headers || {}) } });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text, latency_ms: Date.now() - started };
  } catch (e: any) {
    return { ok: false, status: 0, text: '', latency_ms: Date.now() - started, error: e?.message || 'FETCH_FAILED' };
  } finally { clearTimeout(t); }
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const r = await fetchText(url, { ...init, headers: { Accept: 'application/json', ...(init.headers || {}) } });
  let json: any = null;
  try { json = r.text ? JSON.parse(r.text) : null; } catch {}
  return { ...r, json };
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function contractSymbol(symbol: string) {
  return symbol.replace(/USDT$/, '_USDT');
}

export async function fetchDerivatives(symbol = 'BTCUSDT') {
  const s = contractSymbol(symbol);
  const [funding, ticker] = await Promise.all([
    fetchJson(`${MEXC_CONTRACT}/api/v1/contract/funding_rate/${s}`),
    fetchJson(`${MEXC_CONTRACT}/api/v1/contract/ticker?symbol=${s}`),
  ]);
  const f = funding.json?.data;
  const t = ticker.json?.data;
  const ok = funding.ok && ticker.ok && funding.json?.success === true && ticker.json?.success === true;
  if (!ok) return { status: 'UNAVAILABLE', source: 'MEXC_FUTURES_PUBLIC', symbol, confirmed: false, funding_http: funding.status, ticker_http: ticker.status };
  const rate = n(f?.fundingRate);
  const holdVol = n(t?.holdVol);
  const fair = n(t?.fairPrice);
  const index = n(t?.indexPrice);
  const last = n(t?.lastPrice);
  const basisPct = fair && index ? ((fair - index) / index) * 100 : null;
  return {
    status: 'LIVE', source: 'MEXC_FUTURES_PUBLIC', symbol, confirmed: true,
    funding_rate: rate, funding_rate_pct: rate === null ? null : rate * 100,
    funding_cycle_hours: n(f?.collectCycle), next_funding_time: f?.nextSettleTime ? new Date(Number(f.nextSettleTime)).toISOString() : null,
    open_interest_contracts_proxy: holdVol,
    fair_price: fair, index_price: index, last_price: last, basis_pct: basisPct,
    crowding: rate === null ? 'UNKNOWN' : rate > 0.0005 ? 'LONG_CROWDED' : rate < -0.0005 ? 'SHORT_CROWDED' : 'BALANCED',
    latency_ms: Math.max(funding.latency_ms, ticker.latency_ms), checked_at: new Date().toISOString(),
  };
}

function lastCsvValue(csv: string): { date: string | null, value: number | null } {
  const lines = csv.trim().split(/\r?\n/).slice(1).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const [date, raw] = lines[i].split(',');
    const value = Number(raw);
    if (date && Number.isFinite(value)) return { date, value };
  }
  return { date: null, value: null };
}

export async function fetchMacro() {
  const [dff, dgs10] = await Promise.all([fetchText(FRED_DFF), fetchText(FRED_DGS10)]);
  if (!dff.ok && !dgs10.ok) return { status: 'UNAVAILABLE', source: 'FRED_PUBLIC_CSV', confirmed: false, dff_http: dff.status, dgs10_http: dgs10.status };
  const ff = dff.ok ? lastCsvValue(dff.text) : { date: null, value: null };
  const y10 = dgs10.ok ? lastCsvValue(dgs10.text) : { date: null, value: null };
  return {
    status: 'LIVE', source: 'FRED_PUBLIC_CSV', confirmed: true,
    fed_funds_effective_pct: ff.value, fed_funds_date: ff.date,
    us10y_pct: y10.value, us10y_date: y10.date,
    regime_hint: ff.value !== null && y10.value !== null ? (y10.value > ff.value ? 'CURVE_POSITIVE' : 'CURVE_INVERTED_OR_FLAT') : 'UNKNOWN',
    checked_at: new Date().toISOString(),
  };
}

export async function fetchCotBitcoin() {
  const r = await fetchText(CFTC_TFF);
  if (!r.ok) return { status: 'UNAVAILABLE', source: 'CFTC_TFF', confirmed: false, http: r.status };
  const line = r.text.split(/\r?\n/).find((x) => /BITCOIN/i.test(x));
  if (!line) return { status: 'NO_MATCH', source: 'CFTC_TFF', confirmed: false, note: 'Bitcoin row not found in current TFF file' };
  // Preserve the official row rather than silently guessing column semantics.
  const cols = line.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
  return {
    status: 'LIVE', source: 'CFTC_TFF', confirmed: true,
    market: cols[0] || 'BITCOIN', report_date_raw: cols[2] || cols[1] || null,
    open_interest: n(cols[7]),
    raw_columns: cols.slice(0, 20),
    interpretation_status: 'RAW_VERIFIED_NOT_EXECUTION_GATE',
    checked_at: new Date().toISOString(),
  };
}

function decodeXml(s: string) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function parseRssItems(xml: string) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 10).map((item) => {
    const get = (tag: string) => decodeXml((((item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1]) || '').trim());
    return { title: get('title') || null, url: get('link') || null, seen_at: get('pubDate') || null, source: get('source') || null };
  });
}

export async function fetchNewsRisk() {
  const q = encodeURIComponent('(bitcoin OR ethereum OR crypto) (fed OR inflation OR cpi OR jobs OR sec OR hack OR liquidation)');
  const gdelt = await fetchJson(`${GDELT}?query=${q}&mode=ArtList&maxrecords=10&format=json`);
  if (gdelt.ok) {
    const arts = Array.isArray(gdelt.json?.articles) ? gdelt.json.articles : [];
    return {
      status: 'LIVE', source: 'GDELT_DOC_2', confirmed: true,
      article_count: arts.length,
      headlines: arts.slice(0, 8).map((a: any) => ({ title: a.title || null, domain: a.domain || null, seen_at: a.seendate || null, url: a.url || null })),
      news_clear: null,
      checked_at: new Date().toISOString(),
    };
  }
  const rssQ = encodeURIComponent('bitcoin OR ethereum crypto fed inflation SEC hack liquidation');
  const rss = await fetchText(`${GOOGLE_NEWS_RSS}?q=${rssQ}&hl=en-US&gl=US&ceid=US:en`);
  if (!rss.ok) return { status: 'UNAVAILABLE', source: 'GDELT_DOC_2+GOOGLE_NEWS_RSS', confirmed: false, gdelt_http: gdelt.status, rss_http: rss.status, fail_closed: true };
  const headlines = parseRssItems(rss.text);
  return {
    status: 'LIVE_FALLBACK', source: 'GOOGLE_NEWS_RSS', confirmed: true,
    primary_source_failed: 'GDELT_DOC_2', primary_http: gdelt.status,
    article_count: headlines.length, headlines,
    news_clear: null,
    checked_at: new Date().toISOString(),
  };
}

export async function fetchDuneWhale() {
  const apiKey = env('DUNE_API_KEY');
  const queryId = env('DUNE_WHALE_QUERY_ID');
  if (!apiKey || !queryId) {
    return { status: 'NOT_CONFIGURED', source: 'DUNE', confirmed: false, required_secrets: ['DUNE_API_KEY', 'DUNE_WHALE_QUERY_ID'], fail_closed: true };
  }
  const r = await fetchJson(`https://api.dune.com/api/v1/query/${encodeURIComponent(queryId)}/results?limit=100`, { headers: { 'X-Dune-Api-Key': apiKey } });
  if (!r.ok) return { status: 'UNAVAILABLE', source: 'DUNE', confirmed: false, http: r.status, fail_closed: true };
  const rows = Array.isArray(r.json?.result?.rows) ? r.json.result.rows : [];
  return {
    status: 'LIVE', source: 'DUNE', confirmed: true, query_id: queryId,
    row_count: rows.length, rows: rows.slice(0, 100),
    execution_ended_at: r.json?.execution_ended_at || null,
    checked_at: new Date().toISOString(),
  };
}

export async function fetchAscanContext(symbol = 'BTCUSDT') {
  const [derivatives, macro, cot, news, whale] = await Promise.all([
    fetchDerivatives(symbol), fetchMacro(), fetchCotBitcoin(), fetchNewsRisk(), fetchDuneWhale(),
  ]);
  const sources = { derivatives, macro, cot, news, whale };
  const confirmedCount = Object.values(sources).filter((x: any) => x?.confirmed === true).length;
  return {
    status: confirmedCount === 5 ? 'LIVE_5_OF_5' : confirmedCount >= 3 ? 'PARTIAL_LIVE' : 'DEGRADED',
    symbol, confirmed_sources: confirmedCount, total_sources: 5, sources,
    execution_gate_effect: 'NONE',
    a_plus_4_gate_unchanged: true,
    checked_at: new Date().toISOString(),
  };
}
