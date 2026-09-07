import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { scanAllLiveSniperSignals } from '../../shared/sniperLive.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const started = Date.now();
    const signals = await scanAllLiveSniperSignals();
    const confirmed = signals.filter((s: any) => s.source_confirmed);
    const enter = signals.filter((s: any) => s.decision === 'ENTER').length;
    return Response.json({
      status: confirmed.length === signals.length ? 'LIVE' : confirmed.length ? 'DEGRADED' : 'OFFLINE',
      source_type: 'LIVE_PUBLIC_REST',
      checked_at: new Date().toISOString(),
      scan_latency_ms: Date.now() - started,
      signals,
      summary: { scanned: signals.length, confirmed: confirmed.length, a_plus_enter: enter },
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
    });
  } catch (e: any) {
    return Response.json({ status: 'ERROR', error: e?.message || 'SCAN_FAILED', signals: [], order_send: 'BLOCKED', live_execution: 'BLOCKED' }, { status: 500 });
  }
}
