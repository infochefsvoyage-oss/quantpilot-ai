// QuantPilot — A+/QUALIFIED_MANUAL Setup Evaluation v0.2.0
// Orchestriert: Live-Signal → A+-Gate (fail-closed) → Order Card → Telegram Notify
// + Live-/Shadow-Test + synthetischer A+-Dry-Test (Ende-zu-Ende ohne Brokerorder).
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.
//
// Safety-Regeln:
//   - AUTO_EXECUTION = OFF, order_send = BLOCKED (keine echte Order)
//   - Stop nie erweitern, kein Add vor Schutz, No Fill > No Chase
//   - XAUUSD CORE LONG geschützt; Exposure-/Reconciliation-Management priorisiert
//   - OBSERVED/INFERRED/SCENARIO sauber getrennt
//
// Secrets: MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//          WHALE_ALERT_API_KEY (optional).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { scanAllLiveSniperSignals } from '../../shared/sniperLive.ts';
import { evaluateAPlusGate, mapSignalToAPlusInput } from '../../shared/aPlusGate.ts';
import { buildOrderCard, buildSyntheticAPlusSignal } from '../../shared/orderCardBuilder.ts';
import { sendTelegramNotify } from '../../shared/telegramNotify.ts';
import { fetchMarketIntelligence } from '../../shared/marketIntelligence.ts';
import { fetchJson, SYMBOL } from '../../shared/mt5Bridge.ts';

const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000; // 10 min Dedup/Cooldown
const CORE_LONG_TICKET = 138589574; // XAUUSD CORE LONG — unveränderlich gesperrt
const HEDGE_TICKET = 138887012;      // Hedge — schrittweise verwaltbar

function fingerprint(signal: any): string {
  return `${signal?.symbol || '?'}-${signal?.side || '?'}-${Math.round(Number(signal?.entry_price || 0) * 100)}-${Math.round(Number(signal?.stop_loss || 0) * 100)}`;
}

async function checkNotifyDedup(base44: any, fp: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - NOTIFY_COOLDOWN_MS).toISOString();
    const logs = await base44.asServiceRole.entities.AuditLog.list('-created_date', 20);
    return (logs || []).some((l: any) =>
      l.event === 'A_PLUS_NOTIFY_SENT'
      && l.metadata?.fingerprint === fp
      && l.created_date >= since
    );
  } catch { return false; }
}

async function fetchAccountSpecs(): Promise<any> {
  const bridgeUrl = secrets.get('MT5_BRIDGE_URL');
  const apiKey = secrets.get('MT5_BRIDGE_API_KEY');
  if (!bridgeUrl) return null;
  const headers = apiKey ? { 'X-API-Key': apiKey } : {};
  const base = bridgeUrl.replace(/\/+$/, '');
  const [acc, sym] = await Promise.all([
    fetchJson(`${base}/account`, headers),
    fetchJson(`${base}/symbols/${SYMBOL}/info`, headers),
  ]);
  if (!acc.ok || !sym.ok) return null;
  const a = acc.json?.account || {};
  const s = sym.json?.symbol || sym.json || {};
  return {
    balance: a.balance ?? null,
    equity: a.equity ?? null,
    contract_size: s.contract_size ?? s.trade_contract_size ?? null,
    volume_min: s.volume_min ?? s.min_volume ?? null,
    volume_max: s.volume_max ?? s.max_volume ?? null,
    volume_step: s.volume_step ?? s.step_volume ?? null,
    tick_value: s.tick_value ?? null,
    tick_size: s.tick_size ?? null,
    currency: a.currency || null,
  };
}

async function fetchCurrentPrice(): Promise<{ price: number | null; source: string; timestamp: string; bid: number | null; ask: number | null }> {
  const bridgeUrl = secrets.get('MT5_BRIDGE_URL');
  const apiKey = secrets.get('MT5_BRIDGE_API_KEY');
  if (!bridgeUrl) return { price: null, source: 'NO_BRIDGE', timestamp: new Date().toISOString(), bid: null, ask: null };
  const headers = apiKey ? { 'X-API-Key': apiKey } : {};
  const tick = await fetchJson(`${bridgeUrl.replace(/\/+$/, '')}/symbols/${SYMBOL}/tick`, headers);
  if (!tick.ok) return { price: null, source: 'BRIDGE_FAIL', timestamp: new Date().toISOString(), bid: null, ask: null };
  const t = tick.json || {};
  const price = t.last ?? (t.bid != null && t.ask != null ? (t.bid + t.ask) / 2 : null);
  return { price, source: 'MT5_BRIDGE_LIVE', timestamp: new Date().toISOString(), bid: t.bid ?? null, ask: t.ask ?? null };
}

export default async function(req: Request): Promise<Response> {
  const tStart = Date.now();
  let body: any = {};
  try { body = await req.json().catch(() => ({})); } catch (_) { /* ignore */ }
  const requestedSymbol = body?.symbol || null;
  const dryTest = body?.dry_test === true;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ─── 1) Live-Signale scannen (bestehende Pipeline) ──────────────────
    const signals = await scanAllLiveSniperSignals();
    const candidate = requestedSymbol
      ? signals.find((s: any) => s.symbol === requestedSymbol)
      : signals.find((s: any) => s.decision === 'ENTER') || signals[0] || null;

    // ─── 2) Account-Specs + aktueller Kurs ──────────────────────────────
    const [accountSpecs, currentPrice] = await Promise.all([
      fetchAccountSpecs().catch(() => null),
      fetchCurrentPrice().catch(() => ({ price: null, source: 'ERROR', timestamp: new Date().toISOString(), bid: null, ask: null })),
    ]);

    // ─── 3) A+-Gate evaluieren (fail-closed) ────────────────────────────
    let gateResult: any = null;
    let orderCard: any = null;
    let evaluatedSignal: any = null;

    if (candidate) {
      evaluatedSignal = candidate;
      const gateInput = mapSignalToAPlusInput(candidate);
      gateResult = evaluateAPlusGate(gateInput);
      orderCard = buildOrderCard(candidate, gateResult, accountSpecs);
    } else {
      gateResult = { a_plus: false, qualified_manual: false, trigger_near: false, fail_closed_reason: 'NO_SIGNAL', checks: {}, mandatory_passed: 0, mandatory_total: 9 };
    }

    // ─── 4) Telegram Notify (mit Dedup/Cooldown) ────────────────────────
    let telegramStatus: any = { sent: false, skipped: true, error: 'no_signal', http_status: null, latency_ms: 0 };
    if (candidate && (gateResult.a_plus || gateResult.trigger_near)) {
      const fp = fingerprint(candidate);
      const deduped = await checkNotifyDedup(base44, fp);
      if (deduped) {
        telegramStatus = { sent: false, skipped: true, error: 'DEDUP_COOLDOWN', http_status: null, latency_ms: 0 };
      } else {
        const msg = gateResult.a_plus
          ? `🎯 A+ QUALIFIED_MANUAL bestätigt\n${orderCard.instrument} ${orderCard.direction}\nEntry: ${orderCard.entry ?? '—'}\nSL: ${orderCard.stop_loss ?? '—'}\nTP1/2/3: ${orderCard.take_profits.tp1 ?? '—'}/${orderCard.take_profits.tp2 ?? '—'}/${orderCard.take_profits.tp3 ?? '—'}\nRR: ${orderCard.expected_rr}\nLot: ${orderCard.lot_size}\nRisiko: ${orderCard.estimated_risk_eur != null ? orderCard.estimated_risk_eur.toFixed(2) + ' EUR' : '—'}\nGewinn: ${orderCard.potential_profit_eur != null ? orderCard.potential_profit_eur.toFixed(2) + ' EUR' : '—'}\n${orderCard.manual_entry_note}\norder_send=BLOCKED · auto=OFF`
          : `⚠️ TRIGGER_NEAR Vorwarnung\n${candidate.symbol} ${candidate.side}\nScore: ${candidate.ascan_score} · RR: ${Number(candidate.rr || 0).toFixed(2)}\nNicht alle A+-Gates bestätigt — keine Order Card freigegeben.`;
        telegramStatus = await sendTelegramNotify(
          { event: gateResult.a_plus ? 'A_PLUS_QUALIFIED' : 'TRIGGER_NEAR', message: msg, severity: gateResult.a_plus ? 'SUCCESS' : 'WARNING' },
          secrets
        );
        // Audit-Log für Dedup
        if (telegramStatus.sent) {
          void base44.asServiceRole.entities.AuditLog.create({
            event: 'A_PLUS_NOTIFY_SENT',
            category: 'TRADING',
            severity: 'INFO',
            actor: user.email || 'system',
            details: msg.slice(0, 500),
            metadata: { fingerprint: fp, gate: gateResult.a_plus ? 'A_PLUS' : 'TRIGGER_NEAR' },
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    }

    // ─── 5) Market Intelligence (OBSERVED) einbinden ─────────────────────
    const marketIntel = await fetchMarketIntelligence(secrets).catch(() => null);

    // ─── 6) Synthetischer A+-Dry-Test (SCENARIO) ────────────────────────
    let dryTestResult: any = null;
    if (dryTest) {
      const synthSignal = buildSyntheticAPlusSignal();
      const synthGate = evaluateAPlusGate(mapSignalToAPlusInput(synthSignal));
      const synthCard = buildOrderCard(synthSignal, synthGate, accountSpecs);
      const dryMsg = `🧪 [DRY TEST] A+ Pipeline Ende-zu-Ende\n${synthCard.instrument} ${synthCard.direction}\nEntry: ${synthCard.entry} · SL: ${synthCard.stop_loss}\nTP1/2/3: ${synthCard.take_profits.tp1}/${synthCard.take_profits.tp2}/${synthCard.take_profits.tp3}\nRR: ${synthCard.expected_rr} · Lot: ${synthCard.lot_size}\nGate: ${synthGate.a_plus ? 'A+ TRUE' : 'BLOCKED'}\norder_send=0 · auto=OFF · KEINE BROKERORDER`;
      const dryTelegram = await sendTelegramNotify(
        { event: 'A_PLUS_DRY_TEST', message: dryMsg, severity: 'INFO' },
        secrets
      );
      dryTestResult = {
        signal: synthSignal,
        gate: synthGate,
        card: synthCard,
        telegram: dryTelegram,
        pass: synthGate.a_plus && synthGate.a_plus === synthCard.card_status === 'QUALIFIED_MANUAL',
      };
    }

    // ─── 7) Safety-Counter & Dokumentation ──────────────────────────────
    const safetyCounter = { order_send: 0, auto_execution: 'OFF', live_orders_sent: 0 };
    const overallPass = !!(gateResult?.a_plus && orderCard?.card_status === 'QUALIFIED_MANUAL' && telegramStatus?.sent)
      || !!(dryTest && dryTestResult?.pass);

    const result = {
      verdict: overallPass ? 'PASS' : 'FAIL',
      checked_at: new Date().toISOString(),
      latency_ms: Date.now() - tStart,
      // OBSERVED — Marktdaten
      observed: {
        current_price: currentPrice,
        account_specs: accountSpecs,
        market_intelligence: marketIntel ? {
          whale_alerts: { available: marketIntel.whale_alerts.available, count: marketIntel.whale_alerts.transactions.length },
          fear_greed: marketIntel.macro_sentiment.fear_greed_index,
          news_count: marketIntel.newsfeed.available ? marketIntel.newsfeed.items.length : 0,
        } : null,
      },
      // INFERRED — A+-Gate-Evaluation
      inferred: {
        signal: evaluatedSignal ? {
          symbol: evaluatedSignal.symbol, side: evaluatedSignal.side,
          ascan_score: evaluatedSignal.ascan_score, rr: evaluatedSignal.rr,
          decision: evaluatedSignal.decision, source_confirmed: evaluatedSignal.source_confirmed,
          data_fresh: evaluatedSignal.data_fresh,
        } : null,
        gate: gateResult,
        order_card: orderCard,
        telegram: telegramStatus,
      },
      // SCENARIO — Synthetischer Dry-Test
      scenario: dryTest ? dryTestResult : null,
      // Safety
      safety: safetyCounter,
      core_long_protection: { ticket: CORE_LONG_TICKET, locked: true, note: 'XAUUSD CORE LONG unveränderlich gesperrt' },
      hedge_management: { ticket: HEDGE_TICKET, mode: 'STEPWISE', note: 'Hedge schrittweise verwaltbar — keine Auto-Modification' },
      rules: ['Stop nie erweitern', 'Kein Add vor Schutz', 'No Fill > No Chase', 'AUTO_EXECUTION=OFF', 'order_send=BLOCKED'],
    };

    // Audit-Log
    void base44.asServiceRole.entities.AuditLog.create({
      event: 'A_PLUS_EVALUATION',
      category: 'TRADING',
      severity: overallPass ? 'INFO' : 'WARNING',
      actor: user.email || 'system',
      details: `verdict=${result.verdict} a_plus=${gateResult?.a_plus} trigger_near=${gateResult?.trigger_near} telegram_sent=${telegramStatus?.sent} dry_test=${dryTest}`,
      metadata: { symbol: evaluatedSignal?.symbol || null, dry_test: dryTest },
      timestamp: result.checked_at,
    }).catch(() => {});

    return Response.json(result);
  } catch (error) {
    return Response.json({
      verdict: 'FAIL', error: error.message,
      checked_at: new Date().toISOString(), latency_ms: Date.now() - tStart,
      safety: { order_send: 0, auto_execution: 'OFF', live_orders_sent: 0 },
      inferred: null, observed: null, scenario: null,
    }, { status: 500 });
  }
}