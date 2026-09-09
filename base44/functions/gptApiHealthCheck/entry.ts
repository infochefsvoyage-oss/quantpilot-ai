// QuantPilot — GPT/OpenAI API Health Check (READ ONLY)
// Purpose: verify server-side OpenAI connectivity/auth without exposing secrets.
// No trading/order capability. Never changes governance or execution locks.
// Vertraulich: API secrets must remain in Base44 server-side secrets only.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const OPENAI_BASE = 'https://api.openai.com/v1';
const TIMEOUT_MS = 10000;

function safeErrorPayload(json: any) {
  const e = json?.error || {};
  return {
    error_type: typeof e.type === 'string' ? e.type : null,
    error_code: typeof e.code === 'string' ? e.code : null,
    error_param: typeof e.param === 'string' ? e.param : null,
  };
}

function classify(status: number, json: any, networkError?: string | null) {
  const err = json?.error || {};
  const code = String(err.code || '').toLowerCase();
  const type = String(err.type || '').toLowerCase();

  if (networkError) return { status: 'NETWORK_ERROR', auth_valid: null, quota_state: 'UNKNOWN' };
  if (status === 401 || code.includes('invalid_api_key') || type.includes('authentication')) {
    return { status: 'AUTH_ERROR', auth_valid: false, quota_state: 'UNKNOWN' };
  }
  if (status === 429) {
    const quotaCodes = [
      'credit_balance_exhausted',
      'organization_usage_limit_exceeded',
      'organization_spend_limit_exceeded',
      'project_spend_limit_exceeded',
      'insufficient_quota',
    ];
    const quota = quotaCodes.some((x) => code.includes(x)) || type.includes('insufficient_quota');
    return quota
      ? { status: 'QUOTA_ERROR', auth_valid: true, quota_state: 'EXHAUSTED_OR_LIMITED' }
      : { status: 'RATE_LIMITED', auth_valid: true, quota_state: 'AVAILABLE_OR_UNKNOWN' };
  }
  if (status >= 200 && status < 300) {
    return { status: 'CONNECTED', auth_valid: true, quota_state: 'AVAILABLE_OR_UNKNOWN' };
  }
  if (status >= 500) return { status: 'UPSTREAM_ERROR', auth_valid: null, quota_state: 'UNKNOWN' };
  return { status: 'API_ERROR', auth_valid: null, quota_state: 'UNKNOWN' };
}

async function openaiRequest(path: string, apiKey: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${OPENAI_BASE}${path}`, {
      ...init,
      method: init.method || 'GET',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: res.ok,
      http_status: res.status,
      json,
      latency_ms: Date.now() - started,
      request_id: res.headers.get('x-request-id') || null,
      retry_after: res.headers.get('retry-after') || null,
      network_error: null,
    };
  } catch (e: any) {
    return {
      ok: false,
      http_status: 0,
      json: null,
      latency_ms: Date.now() - started,
      request_id: null,
      retry_after: null,
      network_error: e?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function logHealth(base44: any, result: any) {
  try {
    const severity = result.status === 'CONNECTED'
      ? 'INFO'
      : ['QUOTA_ERROR', 'RATE_LIMITED'].includes(result.status)
        ? 'WARNING'
        : 'ERROR';

    await base44.asServiceRole.entities.AuditLog.create({
      event: 'GPT_API_HEALTH_CHECK',
      category: 'SYSTEM',
      severity,
      actor: 'gpt_api_monitor',
      details: `GPT API Monitor: ${result.status} — auth=${String(result.auth_valid)} — quota=${result.quota_state}`,
      metadata: {
        ...result,
        api_key_present: undefined,
        order_send: 'BLOCKED',
        live_execution: 'BLOCKED',
        governance_effect: result.status === 'CONNECTED' ? 'NONE' : 'AI_DEGRADED',
      },
    });
  } catch (_) {}
}

export default async function(req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('OPENAI_API_KEY');
    const healthModel = secrets.get('OPENAI_HEALTH_MODEL');
    const body = await req.json().catch(() => ({}));
    const activeProbeRequested = body?.active_probe === true;
    const checkedAt = new Date().toISOString();

    if (!apiKey) {
      const result = {
        status: 'NOT_CONFIGURED',
        configured: false,
        api_reachable: null,
        auth_valid: null,
        quota_state: 'UNKNOWN',
        http_status: null,
        error_type: null,
        error_code: null,
        request_id: null,
        retry_after: null,
        checked_at: checkedAt,
        latency_ms: Date.now() - started,
        monitor_mode: 'READ_ONLY_MODELS_PROBE',
        active_probe_requested: activeProbeRequested,
        active_probe_available: !!healthModel,
        governance_effect: 'AI_DEGRADED',
        order_send: 'BLOCKED',
        live_execution: 'BLOCKED',
      };
      await logHealth(base44, result);
      return Response.json(result);
    }

    // GET /models is deliberately read-only and avoids generating billable model output.
    // It verifies network reachability and API-key authentication. Quota exhaustion can only
    // be proven when OpenAI returns the corresponding error; this check never guesses quota.
    const authProbe = await openaiRequest('/models', apiKey);
    let probe = authProbe;
    let monitorMode = 'READ_ONLY_MODELS_PROBE';
    let activeProbePerformed = false;

    // Optional manual deep probe: proves that an actual model request can be accepted and
    // therefore surfaces quota/spend-limit errors. It is never run unless explicitly requested
    // AND OPENAI_HEALTH_MODEL is configured server-side.
    if (authProbe.ok && activeProbeRequested && healthModel) {
      probe = await openaiRequest('/responses', apiKey, {
        method: 'POST',
        body: JSON.stringify({
          model: healthModel,
          input: 'healthcheck',
          max_output_tokens: 1,
        }),
      });
      monitorMode = 'ACTIVE_RESPONSES_PROBE';
      activeProbePerformed = true;
    }

    const cls = classify(probe.http_status, probe.json, probe.network_error);
    const safeErr = safeErrorPayload(probe.json);

    const result = {
      status: cls.status,
      configured: true,
      api_reachable: probe.http_status > 0,
      auth_valid: authProbe.ok ? true : cls.auth_valid,
      quota_state: activeProbePerformed ? cls.quota_state : 'UNKNOWN',
      http_status: probe.http_status || null,
      ...safeErr,
      request_id: probe.request_id,
      retry_after: probe.retry_after,
      network_error: probe.network_error,
      checked_at: checkedAt,
      latency_ms: probe.latency_ms,
      monitor_mode: monitorMode,
      active_probe_requested: activeProbeRequested,
      active_probe_available: !!healthModel,
      active_probe_performed: activeProbePerformed,
      governance_effect: cls.status === 'CONNECTED' ? 'NONE' : 'AI_DEGRADED',
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
    };

    await logHealth(base44, result);
    return Response.json(result);
  } catch (e: any) {
    const result = {
      status: 'MONITOR_ERROR',
      configured: null,
      api_reachable: null,
      auth_valid: null,
      quota_state: 'UNKNOWN',
      error_code: 'GPT_HEALTHCHECK_FAILED',
      checked_at: new Date().toISOString(),
      latency_ms: Date.now() - started,
      governance_effect: 'AI_DEGRADED',
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
    };
    return Response.json(result, { status: 500 });
  }
}
