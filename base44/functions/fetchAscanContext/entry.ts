import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAscanContext } from '../../shared/ascanContext.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let symbol = 'BTCUSDT';
    try {
      const body = req.method === 'POST' ? await req.json() : null;
      if (body?.symbol && typeof body.symbol === 'string') symbol = body.symbol.toUpperCase();
    } catch {}

    const data = await fetchAscanContext(symbol);
    return Response.json({
      ...data,
      source_type: 'ASCAN_CONTEXT_READ_ONLY',
      context_only: true,
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
    });
  } catch (e: any) {
    return Response.json({
      status: 'ERROR_BLOCKED', context_only: true,
      error: e?.message || 'ASCAN_CONTEXT_FAILED',
      order_send: 'BLOCKED', live_execution: 'BLOCKED',
    }, { status: 500 });
  }
}
