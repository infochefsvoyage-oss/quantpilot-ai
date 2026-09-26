// QuantPilot — Modular Telegram Notify Service v0.2.0
// Additive: sendet kurze Status-/Event-Nachrichten an einen Telegram-Chat.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (beide optional — bei Fehlen
// wird graceful degraded und nur geloggt, niemals geworfen).
//
// Usage:
//   import { sendTelegramNotify } from '../../shared/telegramNotify.ts';
//   await sendTelegramNotify({ event: 'AUTO_COMPLETE', message: '...' });

export interface TelegramNotifyPayload {
  event: string;            // z.B. AUTO_COMPLETE, LIVE_TEST, RISK_GATE_FAIL, HEARTBEAT
  message: string;          // Haupttext
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  metadata?: Record<string, any>; // optionale Strukturdaten (nicht im Text ausgegeben)
}

export interface TelegramNotifyResult {
  sent: boolean;
  skipped: boolean;        // true wenn Secrets fehlen → graceful skip
  error: string | null;
  http_status: number | null;
  latency_ms: number;
}

const SEVERITY_EMOJI: Record<string, string> = {
  INFO: 'ℹ️',
  WARNING: '⚠️',
  CRITICAL: '🚨',
  SUCCESS: '✅',
};

const MAX_MESSAGE_LEN = 3500; // Telegram-Limit ~4096, wir halten Reserve für Header

function truncate(text: string, max = MAX_MESSAGE_LEN): string {
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}

function formatMessage(payload: TelegramNotifyPayload): string {
  const emoji = SEVERITY_EMOJI[payload.severity || 'INFO'] || 'ℹ️';
  const ts = new Date().toISOString();
  const header = `${emoji} *QuantPilot · ${payload.event}*`;
  const stamp = `\n🕐 \`${ts}\``;
  const body = truncate(payload.message);
  return `${header}\n${body}${stamp}`;
}

/**
 * Sendet eine Telegram-Nachricht. Fail-safe: wirft nie, loggt nur über das
 * zurückgegebene Resultat. Secrets werden über `secrets.get` gelesen.
 */
export async function sendTelegramNotify(
  payload: TelegramNotifyPayload,
  secretsProvider: { get: (name: string) => string | undefined } | null
): Promise<TelegramNotifyResult> {
  const t0 = Date.now();
  if (!secretsProvider) {
    return { sent: false, skipped: true, error: 'no_secrets_provider', http_status: null, latency_ms: Date.now() - t0 };
  }
  const token = secretsProvider.get('TELEGRAM_BOT_TOKEN');
  const chatId = secretsProvider.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) {
    return { sent: false, skipped: true, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set', http_status: null, latency_ms: Date.now() - t0 };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const text = formatMessage(payload);

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: ctrl.signal,
    });
    const ok = res.ok;
    return {
      sent: ok,
      skipped: false,
      error: ok ? null : `HTTP ${res.status}`,
      http_status: res.status,
      latency_ms: Date.now() - t0,
    };
  } catch (e: any) {
    return { sent: false, skipped: false, error: e?.message || 'fetch_failed', http_status: null, latency_ms: Date.now() - t0 };
  } finally {
    clearTimeout(timeout);
  }
}