// QuantPilot – Candle History Batch Fetcher
// Fetches 20.000 M1 candles (4 Batches à 5000) via start-pagination,
// deduplicates, merges chronologically, and returns compact array format.
// READ-ONLY: no orders, no execution. live_execution stays BLOCKED.
//
// Secrets: MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { SYMBOL, fetchCandleHistory } from '../../shared/mt5Bridge.ts';

const TOTAL_CANDLES = 20000;
const BATCH_SIZE = 5000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const bridgeUrl = secrets.get("MT5_BRIDGE_URL");
    const apiKey = secrets.get("MT5_BRIDGE_API_KEY");
    if (!bridgeUrl) {
      return Response.json({ error: 'MT5_BRIDGE_URL not configured' }, { status: 500 });
    }

    const headers = apiKey ? { "X-API-Key": apiKey } : {};
    const base = bridgeUrl.replace(/\/+$/, "");

    const result = await fetchCandleHistory(base, headers, SYMBOL, "M1", TOTAL_CANDLES, BATCH_SIZE);

    // Compact format: [time, open, high, low, close] per candle — minimizes payload
    const candles = result.candles.map(c => [c.time, c.open, c.high, c.low, c.close]);

    return Response.json({
      symbol: SYMBOL,
      timeframe: "M1",
      candles,
      total_count: result.total_count,
      batches: result.batches_fetched,
      duplicates_removed: result.duplicates_removed,
      first_time: result.first_time,
      last_time: result.last_time,
      gap_count: result.gap_count,
      live_execution_blocked: true,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}