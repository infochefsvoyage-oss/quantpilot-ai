// QuantPilot — Dynamic Milestone Status Aggregator
// Purpose: one quiet backend check for the Meilensteinplan page.
// READ ONLY. No orders. No live execution. No secrets exposed.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { marketFreshness, MARKET_DATA_FRESH_MS } from '../../shared/sniperLive.ts';

const OPENAI_BASE = 'https://api.openai.com/v1';
const TIMEOUT_MS = 9000;
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT'];
const BINANCE_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api-gcp.binance.com',
];
const MEXC_API = 'https://api.mexc.com';
const GO_LIVE_TARGET = '2026-09-06';

type TaskStatus = 'done' | 'active' | 'pending' | 'blocked';
type PhaseStatus = 'DONE' | 'IN_PROGRESS' | 'BLOCKED';

type Task = {
  id: string;
  name: string;
  status: TaskStatus;
  detail?: string;
  evidence?: string;
};

type Phase = {
  id: string;
  phase: string;
  icon: string;
  status: PhaseStatus;
  target: string;
  progress: number;
  tasks: Task[];
};

function nowIso() {
  return new Date().toISOString();
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) / 100 : 0;
}

function phaseStatus(tasks: Task[]): PhaseStatus {
  if (tasks.every((t) => t.status === 'done')) return 'DONE';
  // Rauschfrei: einzelne bekannte Fallback-/Manual-Blocker sollen eine Phase
  // nicht komplett rot einfärben. BLOCKED nur, wenn die Phase vollständig
  // blockiert ist oder explizit mit status: 'BLOCKED' gesetzt wird.
  if (tasks.length > 0 && tasks.every((t) => t.status === 'blocked')) return 'BLOCKED';
  return 'IN_PROGRESS';
}

function withProgress(phase: Omit<Phase, 'progress' | 'status'> & { status?: PhaseStatus }): Phase {
  const done = phase.tasks.filter((t) => t.status === 'done').length;
  const status = phase.status || phaseStatus(phase.tasks);
  return { ...phase, status, progress: pct(done, phase.tasks.length) };
}

function latestLog(logs: any[], event: string) {
  return (logs || []).find((l: any) => l.event === event) || null;
}

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS, headers: Record<string, string> = {}, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...headers, ...(init.headers || {}) },
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, latency_ms: Date.now() - started, error: null as string | null };
  } catch (e: any) {
    return { ok: false, status: 0, json: null, latency_ms: Date.now() - started, error: e?.name === 'AbortError' ? 'TIMEOUT' : (e?.message || 'FETCH_FAILED') };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTickers(raw: any[]) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: any) => SYMBOLS.includes(t.symbol))
    .map((t: any) => {
      const sourceTimestamp = Number(t.closeTime || 0) || null;
      return {
        symbol: t.symbol,
        last_price: Number(t.lastPrice || 0),
        price_change_pct: Number(t.priceChangePercent || 0),
        high_24h: Number(t.highPrice || 0),
        low_24h: Number(t.lowPrice || 0),
        volume_24h: Number(t.volume || 0),
        quote_volume_24h: Number(t.quoteVolume || 0),
        source_timestamp_ms: sourceTimestamp,
        ...marketFreshness(sourceTimestamp),
      };
    });
}

function allSymbolsFresh(tickers: any[]) {
  return SYMBOLS.every((symbol) => tickers.some((t: any) => t.symbol === symbol && t.data_fresh === true));
}

async function probeOpenAI(activeProbeRequested: boolean) {
  const apiKey = secrets.get('OPENAI_API_KEY');
  const healthModel = secrets.get('OPENAI_HEALTH_MODEL');
  if (!apiKey) {
    return {
      status: 'NOT_CONFIGURED', configured: false, auth_valid: null, http_status: null,
      latency_ms: 0, quota_state: 'UNKNOWN', monitor_mode: 'READ_ONLY_MODELS_PROBE',
      active_probe_available: !!healthModel, active_probe_performed: false,
      governance_effect: 'AI_DEGRADED', order_send: 'BLOCKED', live_execution: 'BLOCKED',
    };
  }

  let probe = await fetchWithTimeout(`${OPENAI_BASE}/models`, TIMEOUT_MS, { Authorization: `Bearer ${apiKey}` });
  let monitorMode = 'READ_ONLY_MODELS_PROBE';
  let activeProbePerformed = false;

  if (probe.ok && activeProbeRequested && healthModel) {
    probe = await fetchWithTimeout(`${OPENAI_BASE}/responses`, TIMEOUT_MS, {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }, {
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

  let status = 'API_ERROR';
  let authValid: boolean | null = null;
  let quotaState = 'UNKNOWN';

  const err = probe.json?.error || {};
  const code = String(err.code || '').toLowerCase();
  const type = String(err.type || '').toLowerCase();

  if (probe.error) {
    status = 'NETWORK_ERROR';
  } else if (probe.status === 401 || code.includes('invalid_api_key') || type.includes('authentication')) {
    status = 'AUTH_ERROR'; authValid = false;
  } else if (probe.status === 429) {
    const quota = ['credit_balance_exhausted', 'organization_usage_limit_exceeded', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'insufficient_quota']
      .some((x) => code.includes(x)) || type.includes('insufficient_quota');
    status = quota ? 'QUOTA_ERROR' : 'RATE_LIMITED'; authValid = true;
    quotaState = quota ? 'EXHAUSTED_OR_LIMITED' : 'AVAILABLE_OR_UNKNOWN';
  } else if (probe.status >= 200 && probe.status < 300) {
    status = 'CONNECTED'; authValid = true; quotaState = activeProbePerformed ? 'AVAILABLE_OR_UNKNOWN' : 'UNKNOWN';
  } else if (probe.status >= 500) {
    status = 'UPSTREAM_ERROR';
  }

  return {
    status,
    configured: true,
    api_reachable: probe.status > 0,
    auth_valid: authValid,
    http_status: probe.status || null,
    latency_ms: probe.latency_ms,
    quota_state: quotaState,
    monitor_mode: monitorMode,
    active_probe_available: !!healthModel,
    active_probe_performed: activeProbePerformed,
    error_code: err.code || null,
    error_type: err.type || null,
    governance_effect: status === 'CONNECTED' ? 'NONE' : 'AI_DEGRADED',
    order_send: 'BLOCKED',
    live_execution: 'BLOCKED',
  };
}

async function probeMarketData() {
  let binanceProbe: any = { ok: false, status: 0, json: null, latency_ms: 0, error: 'no_endpoints_tried' };
  for (const base of BINANCE_ENDPOINTS) {
    binanceProbe = await fetchWithTimeout(`${base}/api/v3/ticker/24hr`, 8000);
    if (binanceProbe.ok && Array.isArray(binanceProbe.json)) break;
  }

  const mexcProbe = await fetchWithTimeout(`${MEXC_API}/api/v3/ticker/24hr`, 8000);

  let binanceReachable = binanceProbe.ok && Array.isArray(binanceProbe.json);
  const mexcReachable = mexcProbe.ok && Array.isArray(mexcProbe.json);

  let binanceTickers = binanceReachable ? normalizeTickers(binanceProbe.json) : [];
  const mexcTickers = mexcReachable ? normalizeTickers(mexcProbe.json) : [];

  let binanceNative = binanceReachable ? 'ONLINE' : (binanceProbe.status === 451 ? 'OFFLINE_HTTP_451' : `OFFLINE_HTTP_${binanceProbe.status || 0}`);
  let binanceFallback = 'OFFLINE';
  let binanceSourceMode = binanceReachable ? 'NATIVE' : 'NATIVE_FAILED';
  let binanceActualSource = binanceReachable ? 'BINANCE' : null;
  let binanceError = binanceProbe.error || (binanceProbe.status ? `HTTP ${binanceProbe.status}` : 'UNKNOWN');

  if (!binanceReachable && mexcReachable) {
    binanceReachable = true;
    binanceTickers = mexcTickers;
    binanceFallback = 'ONLINE_VIA_MEXC';
    binanceSourceMode = 'MEXC_FALLBACK';
    binanceActualSource = 'MEXC';
    binanceError = `${binanceError} → MEXC fallback`;
  }

  const binanceFresh = allSymbolsFresh(binanceTickers);
  const mexcFresh = allSymbolsFresh(mexcTickers);

  return {
    freshness_threshold_ms: MARKET_DATA_FRESH_MS,
    binance_native: binanceNative,
    binance_fallback: binanceFallback,
    binance_source_mode: binanceSourceMode,
    binance_actual_source_exchange: binanceActualSource,
    binance_reachable: binanceReachable,
    binance_error: binanceError,
    binance_latency_ms: binanceReachable && binanceSourceMode === 'MEXC_FALLBACK' ? mexcProbe.latency_ms : binanceProbe.latency_ms,
    binance_ticker_freshness: binanceFresh ? 'FRESH' : 'STALE',
    binance_data_fresh: binanceFresh,
    mexc: mexcReachable ? 'ONLINE' : `OFFLINE_HTTP_${mexcProbe.status || 0}`,
    mexc_source_mode: mexcReachable ? 'NATIVE' : 'NATIVE_FAILED',
    mexc_reachable: mexcReachable,
    mexc_latency_ms: mexcProbe.latency_ms,
    mexc_ticker_freshness: mexcFresh ? 'FRESH' : 'STALE',
    mexc_data_fresh: mexcFresh,
    market_data_fresh: binanceFresh || mexcFresh,
    tickers: {
      binance: binanceTickers,
      mexc: mexcTickers,
    },
  };
}

function auditSummary(logs: any[], forwardTrades: any[], gates: any[]) {
  const gptLog = latestLog(logs, 'GPT_API_HEALTH_CHECK');
  const execLog = latestLog(logs, 'EXECUTION_READINESS_CHECK');
  const phase4Log = latestLog(logs, 'NY_LONG_PHASE_4_OOS_VALIDATION');
  const orderSafetyLog = latestLog(logs, 'ORDER_SEND_SAFETY_TEST');
  const autoOrderLog = latestLog(logs, 'AUTO_ORDER_PIPELINE_DRY_RUN');
  const killLog = latestLog(logs, 'KILL_SWITCH_TRIGGERED');
  const paperLogs = (logs || []).filter((l: any) => ['PAPER_TRADE_EXECUTED', 'SNIPER_PAPER_ORDER_CREATED', 'E2E_PAPER_ORDER_CREATED'].includes(l.event));
  const openPaper = (forwardTrades || []).filter((t: any) => t.exit_reason === 'OPEN' || t.status === 'open');
  const gatePassCount = (gates || []).filter((g: any) => g.status === 'PASS').length;

  const phase4Meta = phase4Log?.metadata?.validation || phase4Log?.metadata || {};
  const oosN = Number(phase4Meta.trade_count || 0);
  const remainingN = Math.max(0, 82 - oosN);
  const ci = phase4Meta.ci_95 || [0, 0];
  const power = Number(phase4Meta.power || 0);
  const statPass = oosN >= 82 && Number(ci[0] || 0) > 0 && power >= 0.8;

  return {
    gpt_log: gptLog,
    execution_readiness: execLog?.metadata || null,
    phase4: phase4Meta,
    oos_n: oosN,
    oos_remaining_n: remainingN,
    statistical_pass: statPass,
    order_safety: orderSafetyLog?.metadata || null,
    auto_order: autoOrderLog?.metadata || null,
    kill_switch_triggered: !!killLog,
    paper_trade_count: paperLogs.length,
    open_paper_trade_count: openPaper.length,
    go_live_gate_pass_count: gatePassCount,
    go_live_gate_total: 10,
  };
}

function buildMilestones(gpt: any, market: any, audit: any, githubSyncStatus: string, targetStatus: string): Phase[] {
  const gptDone = gpt?.status === 'CONNECTED';
  const mexcDone = market?.mexc === 'ONLINE' && market?.mexc_data_fresh === true;
  const binanceFallbackDone = market?.binance_fallback === 'ONLINE_VIA_MEXC' && market?.binance_data_fresh === true;
  const binanceNativeBlocked = market?.binance_native !== 'ONLINE';
  const execReady = audit.execution_readiness?.execution_readiness === 'READY';
  const reconPass = audit.execution_readiness?.reconciliation?.status === 'PASS' || audit.execution_readiness?.bridge_contract === 'PASS';
  const paperCount = audit.paper_trade_count || 0;
  const paperStarted = paperCount > 0 || audit.open_paper_trade_count > 0;
  const orderSafetyPass = audit.order_safety?.server_side_check === 'PASS' || audit.order_safety?.order_send === 'REJECTED';
  const autoOrderDryRunPass = audit.auto_order?.status === 'ALL_GATES_PASS_BUT_ORDER_BLOCKED';
  const oosActive = audit.oos_n > 0 && audit.oos_n < 82;
  const oosDone = audit.oos_n >= 82;
  const safetyOk = !audit.kill_switch_triggered;

  const phase4GateTasks: Task[] = [
    { id: 'g1', name: 'G1: MT5 E2E Hardening', status: execReady ? 'done' : 'active', detail: audit.execution_readiness?.bridge_contract || 'prüfen' },
    { id: 'g2', name: 'G2: Market Data Integrity', status: market?.market_data_fresh ? 'done' : 'blocked', detail: market?.binance_source_mode === 'MEXC_FALLBACK' ? 'Fresh via MEXC fallback' : market?.binance_ticker_freshness || 'UNKNOWN' },
    { id: 'g3', name: 'G3: Strategy Frozen', status: 'pending', detail: 'ASCAN final freeze prüfen' },
    { id: 'g4', name: 'G4: Backtest Verified', status: audit.oos_n > 0 ? 'active' : 'pending', detail: `OOS N=${audit.oos_n}` },
    { id: 'g5', name: 'G5: OOS N=82 erreicht', status: oosDone ? 'done' : 'pending', detail: `${audit.oos_remaining_n} verbleibend` },
    { id: 'g6', name: 'G6: Expectancy > 0 konfident', status: audit.statistical_pass ? 'done' : 'pending', detail: 'CI/Power Gate' },
    { id: 'g7', name: 'G7: Shadow Mode bestanden', status: 'pending', detail: '100 Paper/Shadow Trades erforderlich' },
    { id: 'g8', name: 'G8: Semi-Auto Freigabe', status: 'blocked', detail: 'Governance erforderlich' },
    { id: 'g9', name: 'G9: Controlled Live', status: 'blocked', detail: 'nach Shadow + Governance' },
    { id: 'g10', name: 'G10: Safety Net aktiv', status: safetyOk ? 'active' : 'blocked', detail: safetyOk ? 'kein aktueller Kill-Trigger' : 'KillSwitch Trigger vorhanden' },
  ];
  const dynamicGatePassCount = phase4GateTasks.filter((t) => t.status === 'done').length;

  return [
    withProgress({
      id: 'phase_1',
      phase: 'Phase 1 — Infrastruktur & Daten',
      icon: 'Activity',
      target: 'Basis',
      tasks: [
        { id: 'gpt_api', name: 'GPT/OpenAI API Health Check', status: gptDone ? 'done' : 'blocked', detail: gpt?.status || 'UNKNOWN', evidence: gpt?.http_status ? `HTTP ${gpt.http_status}, ${gpt.latency_ms}ms` : undefined },
        { id: 'mexc_data', name: 'MEXC Public Live-Daten', status: mexcDone ? 'done' : 'blocked', detail: market?.mexc || 'UNKNOWN' },
        { id: 'binance_native', name: 'Binance Native API', status: binanceNativeBlocked ? 'blocked' : 'done', detail: market?.binance_native || 'UNKNOWN', evidence: market?.binance_error || undefined },
        { id: 'binance_fallback', name: 'Binance Fallback-Provenance via MEXC Mirror', status: binanceFallbackDone ? 'done' : 'pending', detail: market?.binance_fallback || 'OFFLINE' },
        { id: 'secrets', name: 'Server-Secrets ohne Frontend-Exposure', status: gpt?.configured ? 'done' : 'blocked', detail: 'OPENAI_API_KEY nur serverseitig' },
      ],
    }),
    withProgress({
      id: 'phase_2',
      phase: 'Phase 2 — Strategie-Validierung',
      icon: 'Target',
      target: 'OOS / Statistik',
      tasks: [
        { id: 'a_plus_frozen', name: 'A+ Setup Definition FROZEN', status: 'done', detail: 'Definition vorhanden' },
        { id: 'oos_validation', name: `Phase 4 OOS Validation — N=${audit.oos_n}/82`, status: oosDone ? 'done' : oosActive ? 'active' : 'pending', detail: `${audit.oos_remaining_n} verbleibend` },
        { id: 'statistical_pass', name: 'Statistical Gate: CI/Power positiv', status: audit.statistical_pass ? 'done' : oosActive ? 'active' : 'pending', detail: audit.statistical_pass ? 'PASS' : 'noch nicht bewiesen' },
        { id: 'walk_forward', name: 'Walk-Forward Regression Test', status: audit.phase4?.walk_forward ? ((audit.phase4.walk_forward?.positive || 0) >= 3 ? 'done' : 'active') : 'pending', detail: audit.phase4?.walk_forward ? `${audit.phase4.walk_forward?.positive || 0} positive Blöcke` : 'ausstehend' },
        { id: 'fees_slippage', name: 'Fees/Slippage Simulation', status: 'pending', detail: 'für Live-Freigabe erforderlich' },
      ],
    }),
    withProgress({
      id: 'phase_3',
      phase: 'Phase 3 — Execution Readiness',
      icon: 'ShieldCheck',
      target: 'Dry Run / Paper',
      tasks: [
        { id: 'paper_engine', name: 'Paper Execution Engine', status: paperStarted ? 'active' : 'pending', detail: `${paperCount} Paper-Events` },
        { id: 'order_safety', name: 'Order-Send Safety Test', status: orderSafetyPass ? 'done' : 'pending', detail: orderSafetyPass ? 'serverseitig BLOCKED bewiesen' : 'ausstehend' },
        { id: 'execution_readiness', name: 'Execution Readiness Check', status: execReady ? 'done' : audit.execution_readiness ? 'active' : 'pending', detail: audit.execution_readiness?.execution_readiness || 'kein aktueller Check' },
        { id: 'reconciliation', name: 'Full Reconciliation & Error Rate Audit', status: reconPass ? 'done' : audit.execution_readiness ? 'active' : 'pending', detail: audit.execution_readiness?.reconciliation?.status || audit.execution_readiness?.bridge_contract || 'ausstehend' },
        { id: 'auto_order_dry_run', name: 'Auto-Order Pipeline Dry Run', status: autoOrderDryRunPass ? 'done' : 'pending', detail: autoOrderDryRunPass ? 'alle Pre-Order Gates pass, Order blockiert' : 'ausstehend' },
      ],
    }),
    withProgress({
      id: 'phase_4',
      phase: 'Phase 4 — Go-Live Program (G1–G10)',
      icon: 'Zap',
      target: targetStatus === 'OVERDUE' ? 'Ziel überfällig' : GO_LIVE_TARGET,
      tasks: [
        { id: 'g1', name: 'G1: MT5 E2E Hardening', status: execReady ? 'done' : 'active', detail: audit.execution_readiness?.bridge_contract || 'prüfen' },
        { id: 'g2', name: 'G2: Market Data Integrity', status: market?.market_data_fresh ? 'done' : 'blocked', detail: market?.binance_source_mode === 'MEXC_FALLBACK' ? 'Fresh via MEXC fallback' : market?.binance_ticker_freshness || 'UNKNOWN' },
        { id: 'g3', name: 'G3: Strategy Frozen', status: 'pending', detail: 'ASCAN final freeze prüfen' },
        { id: 'g4', name: 'G4: Backtest Verified', status: audit.oos_n > 0 ? 'active' : 'pending', detail: `OOS N=${audit.oos_n}` },
        { id: 'g5', name: 'G5: OOS N=82 erreicht', status: oosDone ? 'done' : 'pending', detail: `${audit.oos_remaining_n} verbleibend` },
        { id: 'g6', name: 'G6: Expectancy > 0 konfident', status: audit.statistical_pass ? 'done' : 'pending', detail: 'CI/Power Gate' },
        { id: 'g7', name: 'G7: Shadow Mode bestanden', status: 'pending', detail: '100 Paper/Shadow Trades erforderlich' },
        { id: 'g8', name: 'G8: Semi-Auto Freigabe', status: 'blocked', detail: 'Governance erforderlich' },
        { id: 'g9', name: 'G9: Controlled Live', status: 'blocked', detail: 'nach Shadow + Governance' },
        { id: 'g10', name: 'G10: Safety Net aktiv', status: safetyOk ? 'active' : 'blocked', detail: safetyOk ? 'kein aktueller Kill-Trigger' : 'KillSwitch Trigger vorhanden' },
      ],
    }),
    withProgress({
      id: 'phase_5',
      phase: 'Phase 5 — Live Authorization',
      icon: 'Lock',
      status: 'BLOCKED',
      target: targetStatus === 'OVERDUE' ? 'Revision erforderlich' : GO_LIVE_TARGET,
      tasks: [
        { id: 'target_date', name: 'Go-Live Zieltermin aktualisieren', status: targetStatus === 'OVERDUE' ? 'blocked' : 'pending', detail: targetStatus },
        { id: 'github_sync', name: 'GitHub Sync / Branch-Regel', status: githubSyncStatus === 'OK' ? 'done' : 'blocked', detail: githubSyncStatus },
        { id: 'all_gates', name: 'Alle G1–G10 Gates PASS', status: audit.go_live_gate_pass_count >= 10 ? 'done' : 'blocked', detail: `${audit.go_live_gate_pass_count}/10 PASS` },
        { id: 'governance_approval', name: 'Governance 2-Step Approval (ULF)', status: 'blocked', detail: 'manual required' },
        { id: 'live_unlock', name: 'Live Execution Global Unlock', status: 'blocked', detail: 'nicht freigegeben' },
      ],
    }),
  ];
}

function summarize(phases: Phase[]) {
  const tasks = phases.flatMap((p) => p.tasks);
  const done = tasks.filter((t) => t.status === 'done').length;
  const active = tasks.filter((t) => t.status === 'active').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  return { total: tasks.length, done, active, pending, blocked, overall_progress: pct(done, tasks.length) };
}

export default async function(req: Request): Promise<Response> {
  const started = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const activeProbeRequested = body?.active_probe === true;

    const [logs, forwardTrades, gates] = await Promise.all([
      base44.entities.AuditLog.list('-created_date', 120).catch(() => []),
      base44.entities.ForwardTrade.list('-created_date', 500).catch(() => []),
      base44.entities.GoLiveGate.list('-created_date', 50).catch(() => []),
    ]);

    const [gpt, market] = await Promise.all([
      probeOpenAI(activeProbeRequested).catch((e: any) => ({ status: 'MONITOR_ERROR', error: e?.message || 'GPT_CHECK_FAILED', order_send: 'BLOCKED', live_execution: 'BLOCKED' })),
      probeMarketData().catch((e: any) => ({ market_data_fresh: false, binance_native: 'UNKNOWN', binance_fallback: 'OFFLINE', mexc: 'UNKNOWN', error: e?.message || 'MARKET_CHECK_FAILED' })),
    ]);

    const audit = auditSummary(logs, forwardTrades, gates);
    const targetStatus = new Date(`${GO_LIVE_TARGET}T23:59:59Z`).getTime() < Date.now() ? 'OVERDUE' : 'OPEN';

    // Base44 runtime functions cannot reliably inspect repository branch rules.
    // Keep this explicit and non-noisy until an authenticated GitHub sync check exists.
    const githubSyncStatus = 'MANUAL_CHECK_REQUIRED';

    const phases = buildMilestones(gpt, market, audit, githubSyncStatus, targetStatus);
    const summary = summarize(phases);

    const blockers = [
      ...(market.binance_native !== 'ONLINE' ? [{ id: 'binance_native', label: 'Binance Native API', reason: market.binance_native || 'OFFLINE' }] : []),
      ...(targetStatus === 'OVERDUE' ? [{ id: 'target_overdue', label: 'Go-Live Zieltermin', reason: `${GO_LIVE_TARGET} ist überschritten` }] : []),
      { id: 'github_sync', label: 'GitHub Sync', reason: githubSyncStatus },
      ...(audit.oos_n < 82 ? [{ id: 'oos_n', label: 'OOS Validierung', reason: `N=${audit.oos_n}/82, ${audit.oos_remaining_n} verbleibend` }] : []),
      ...(audit.go_live_gate_pass_count < 10 ? [{ id: 'go_live_gates', label: 'G1–G10', reason: `${audit.go_live_gate_pass_count}/10 PASS` }] : []),
      { id: 'live_governance', label: 'Live Execution', reason: 'BLOCKED bis ULF/Governance Approval' },
    ];

    const nextActions = [
      market.binance_native !== 'ONLINE'
        ? 'Dashboard-Provenance beibehalten: Binance Native OFFLINE, Fallback via MEXC Mirror klar anzeigen.'
        : 'Binance Native erneut überwachen und Fallback nur als Reserve halten.',
      targetStatus === 'OVERDUE'
        ? 'Neues realistisches Go-Live-Zieldatum festlegen und alte 06.09.2026-Anzeige als überfällig markieren.'
        : 'Go-Live-Zieldatum weiter überwachen.',
      audit.oos_n < 82
        ? `Phase-4/OOS weiterführen: noch ${audit.oos_remaining_n} valide Trades bis N=82.`
        : 'OOS-N erreicht: CI/Power/Walk-Forward final prüfen.',
      'Paper/Shadow-Validierung mit Kosten-, Slippage- und Reconciliation-Gates fortsetzen.',
      'GitHub Branch-Regel/Berechtigung im Repository prüfen und Sync manuell bestätigen.',
    ];

    const goLiveReady = summary.blocked === 0 && audit.go_live_gate_pass_count >= 10 && audit.statistical_pass;

    const result = {
      timestamp: nowIso(),
      latency_ms: Date.now() - started,
      noise_control: {
        single_backend_aggregator: true,
        frontend_poll_interval_ms: 60000,
        active_openai_probe_default: false,
        active_probe_requested: activeProbeRequested,
        order_send: 'BLOCKED',
        live_execution: 'BLOCKED',
      },
      overall_progress: summary.overall_progress,
      summary,
      go_live_status: goLiveReady ? 'LIVE_READY_PENDING_GOVERNANCE' : 'BLOCKED',
      live_execution: 'BLOCKED',
      target_date: GO_LIVE_TARGET,
      target_status: targetStatus,
      gpt_api: gpt,
      market_data: market,
      execution_readiness: audit.execution_readiness,
      audit_summary: audit,
      github_sync: {
        status: githubSyncStatus,
        reason: 'Base44 function cannot verify GitHub branch protection; UI/repo sync check required.',
      },
      phases,
      blockers,
      next_actions: nextActions,
    };

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        event: 'MILESTONE_STATUS_AGGREGATED',
        category: 'SYSTEM',
        severity: goLiveReady ? 'WARNING' : 'INFO',
        actor: 'fetch_milestone_status',
        details: `Milestone status: ${result.go_live_status} — progress=${Math.round(summary.overall_progress * 100)}% — live=BLOCKED`,
        metadata: {
          overall_progress: summary.overall_progress,
          go_live_status: result.go_live_status,
          live_execution: 'BLOCKED',
          target_status: targetStatus,
          blockers: blockers.map((b) => b.id),
        },
      });
    } catch (_) {}

    return Response.json(result);
  } catch (error: any) {
    return Response.json({
      status: 'ERROR',
      error: error?.message || 'MILESTONE_STATUS_FAILED',
      go_live_status: 'BLOCKED',
      order_send: 'BLOCKED',
      live_execution: 'BLOCKED',
      timestamp: nowIso(),
    }, { status: 500 });
  }
}
