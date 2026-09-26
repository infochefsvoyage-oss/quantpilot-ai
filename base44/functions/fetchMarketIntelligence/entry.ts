// QuantPilot — Market Intelligence Endpoint (Whale + Macro + Newsfeed)
// Additive: kombiniert Whale-Alerts, Macro-Sentiment (Fear & Greed) und
// Crypto-Newsfeed in einem Aufruf. Read-only, keine Orders, kein Execution.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.
//
// Secrets: WHALE_ALERT_API_KEY (optional — graceful skip ohne Key).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { fetchMarketIntelligence } from '../../shared/marketIntelligence.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await fetchMarketIntelligence(secrets);

    // Audit-Log (fire-and-forget)
    void base44.asServiceRole.entities.AuditLog.create({
      event: 'MARKET_INTELLIGENCE_FETCH',
      category: 'SYSTEM',
      severity: 'INFO',
      actor: user.email || 'system',
      details: `whale=${result.whale_alerts.available ? result.whale_alerts.transactions.length + ' tx' : 'N/A'} · fg=${result.macro_sentiment.fear_greed_index ?? 'N/A'} · news=${result.newsfeed.available ? result.newsfeed.items.length + ' items' : 'N/A'}`,
      timestamp: result.fetched_at,
    }).catch(() => {});

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, fetched_at: new Date().toISOString() }, { status: 500 });
  }
}