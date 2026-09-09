// QuantPilot — Intelligence Layer Status (READ ONLY / ADDITIVE ONLY)
// Aggregates ASCAN contextual intelligence + GPT API monitor state.
// IMPORTANT: This layer NEVER changes the 4/4 A+ execution decision, Risk Gate,
// Governance locks, order_send, or live_execution.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAscanContext } from '../../shared/ascanContext.ts';

const GPT_HEALTH_EVENT = 'GPT_API_HEALTH_CHECK';

function normalizeGptStatus(log:any) {
  const m = log?.metadata || {};
  const status = m.status || null;
  if (!status) return {
    status: 'UNKNOWN',
    ai_state: 'AI_DEGRADED',
    auth_valid: null,
    quota_state: 'UNKNOWN',
    checked_at: log?.created_date || null,
    source: 'AUDITLOG_GPT_API_HEALTH_CHECK',
  };
  return {
    status,
    ai_state: status === 'CONNECTED' ? 'AI_HEALTHY' : 'AI_DEGRADED',
    auth_valid: m.auth_valid ?? null,
    quota_state: m.quota_state || 'UNKNOWN',
    checked_at: m.checked_at || log?.created_date || null,
    latency_ms: m.latency_ms ?? null,
    monitor_mode: m.monitor_mode || null,
    source: 'AUDITLOG_GPT_API_HEALTH_CHECK',
  };
}

function intelligenceVerdict(context:any, gpt:any) {
  const confirmed = Number(context?.confirmed_sources || 0);
  const gptHealthy = gpt?.ai_state === 'AI_HEALTHY';
  if (confirmed >= 3 && gptHealthy) return 'INTELLIGENCE_HEALTHY';
  if (confirmed >= 2 || gptHealthy) return 'INTELLIGENCE_PARTIAL';
  return 'INTELLIGENCE_DEGRADED';
}

export default async function(req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const symbol = String(body?.symbol || 'BTCUSDT').toUpperCase();

    const [context, logs] = await Promise.all([
      fetchAscanContext(symbol),
      base44.entities.AuditLog.list('-created_date', 100),
    ]);

    const latestGptLog = logs.find((x:any) => x?.event === GPT_HEALTH_EVENT) || null;
    const gpt = normalizeGptStatus(latestGptLog);
    const verdict = intelligenceVerdict(context, gpt);

    const result = {
      status: verdict,
      symbol,
      context,
      gpt_monitor: gpt,
      policy: {
        role: 'CONTEXT_AND_ANALYSIS_ONLY',
        additive_only: true,
        execution_gate_effect: 'NONE',
        a_plus_4_gate_unchanged: true,
        risk_gate_unchanged: true,
        governance_lock_unchanged: true,
        fallback_mode: gpt.ai_state === 'AI_HEALTHY' ? 'GPT_PLUS_DATA_SOURCES' : 'DETERMINISTIC_DATA_SOURCES_ONLY',
      },
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
      checked_at: new Date().toISOString(),
      latency_ms: Date.now() - started,
    };

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        event: 'INTELLIGENCE_LAYER_STATUS',
        category: 'SYSTEM',
        severity: verdict === 'INTELLIGENCE_HEALTHY' ? 'INFO' : 'WARNING',
        actor: 'intelligence_layer',
        details: `${verdict} — context=${context?.confirmed_sources || 0}/${context?.total_sources || 5} — GPT=${gpt.status}`,
        metadata: {
          status: verdict,
          symbol,
          confirmed_sources: context?.confirmed_sources || 0,
          total_sources: context?.total_sources || 5,
          gpt_status: gpt.status,
          ai_state: gpt.ai_state,
          execution_gate_effect: 'NONE',
          order_send: 'BLOCKED',
          live_execution: 'BLOCKED',
        },
      });
    } catch (_) {}

    return Response.json(result);
  } catch (e:any) {
    return Response.json({
      status: 'INTELLIGENCE_DEGRADED',
      error: e?.message || 'INTELLIGENCE_LAYER_FAILED',
      execution_gate_effect: 'NONE',
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
      checked_at: new Date().toISOString(),
    }, { status: 500 });
  }
}
