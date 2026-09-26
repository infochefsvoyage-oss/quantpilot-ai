import React, { useState } from "react";
import { ShieldCheck, Send, FlaskConical, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

// A+/QUALIFIED_MANUAL Order Card — ergänzt SniperMode modular.
// Zeigt das A+-Gate-Ergebnis, die erzeugte Order Card und Telegram-Status.
// AUTO_EXECUTION=OFF, order_send=BLOCKED — keine echte Order.
export default function APlusOrderCard({ symbol }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dryTest, setDryTest] = useState(false);

  const runEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await base44.functions.invoke("evaluateAPlusSetup", { symbol: symbol || null, dry_test: dryTest });
      setResult(raw?.data || raw);
    } catch (e) {
      setError(e?.message || "EVALUATION_FAILED");
    } finally {
      setLoading(false);
    }
  };

  const gate = result?.inferred?.gate;
  const card = result?.inferred?.order_card;
  const telegram = result?.inferred?.telegram;
  const observed = result?.observed;
  const scenario = result?.scenario;
  const safety = result?.safety;

  return (
    <PanelCard
      title="A+ QUALIFIED_MANUAL · Order Card & Telegram Notify"
      action={<StatusBadge status={result?.verdict || "IDLE"} color={result?.verdict === "PASS" ? "profit" : result?.verdict === "FAIL" ? "loss" : "muted"} />}
    >
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={runEvaluation}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "EVALUIERE…" : "A+ SETUP EVALUIEREN"}
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={dryTest} onChange={(e) => setDryTest(e.target.checked)} className="accent-primary" />
          Synthetischer Dry-Test
        </label>
        <span className="font-mono text-xs text-muted-foreground">{symbol ? `Symbol: ${symbol}` : "Top-Signal auto"}</span>
      </div>

      {error && <div className="mb-3 rounded border border-loss/30 bg-loss/5 px-3 py-2 text-xs text-loss">{error}</div>}

      {/* Safety Banner */}
      <div className="mb-4 flex items-center gap-2 rounded-md border border-loss/20 bg-loss/5 px-3 py-2">
        <Lock className="h-4 w-4 shrink-0 text-loss" />
        <span className="font-mono text-xs text-loss">
          AUTO_EXECUTION=OFF · order_send=BLOCKED · Stop nie erweitern · No Fill &gt; No Chase · Core Long {result?.core_long_protection?.ticket || "138589574"} gesperrt
        </span>
      </div>

      {/* A+ Gate Checks */}
      {gate && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">A+ Gate (fail-closed)</span>
            <span className={`font-mono text-xs font-bold ${gate.a_plus ? "text-profit" : gate.trigger_near ? "text-warning" : "text-loss"}`}>
              {gate.a_plus ? "A+ TRUE · QUALIFIED_MANUAL" : gate.trigger_near ? "TRIGGER_NEAR" : "BLOCKED"} · {gate.mandatory_passed}/{gate.mandatory_total}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            {Object.entries(gate.checks || {}).map(([k, v]) => (
              <div key={k} className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${v ? "border-profit/20 bg-profit/5 text-profit" : "border-loss/20 bg-loss/5 text-loss"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${v ? "bg-profit" : "bg-loss"}`} />
                <span className="font-mono">{k}</span>
              </div>
            ))}
          </div>
          {gate.fail_closed_reason && <div className="mt-2 font-mono text-xs text-loss">{gate.fail_closed_reason}</div>}
        </div>
      )}

      {/* Order Card */}
      {card && (
        <div className="mb-4 rounded-md border border-border bg-secondary/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm font-bold">{card.instrument} · {card.direction}</span>
            <StatusBadge status={card.card_status} color={card.card_status === "QUALIFIED_MANUAL" ? "profit" : card.card_status === "TRIGGER_NEAR" ? "warning" : "loss"} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <CardField label="Entry" value={card.entry ?? "—"} />
            <CardField label="Stop Loss" value={card.stop_loss ?? "—"} color="loss" />
            <CardField label="TP1" value={card.take_profits?.tp1 ?? "—"} color="profit" />
            <CardField label="TP2" value={card.take_profits?.tp2 ?? "—"} color="profit" />
            <CardField label="TP3 / Final" value={card.take_profits?.tp3 ?? card.take_profits?.final_tp ?? "—"} color="profit" />
            <CardField label="RR" value={Number(card.expected_rr || 0).toFixed(2)} />
            <CardField label="Lot" value={typeof card.lot_size === "number" ? card.lot_size : "Screenshot"} />
            <CardField label="Risiko EUR" value={card.estimated_risk_eur != null ? card.estimated_risk_eur.toFixed(2) + " €" : "—"} color="loss" />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <CardField label="Gewinn EUR" value={card.potential_profit_eur != null ? card.potential_profit_eur.toFixed(2) + " €" : "—"} color="profit" />
            <div className="rounded border border-border bg-secondary/50 px-2 py-1.5">
              <div className="text-xs text-muted-foreground">Lot-Note</div>
              <div className="mt-0.5 font-mono text-xs text-foreground">{card.lot_size_note || "Specs verfügbar"}</div>
            </div>
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">{card.manual_entry_note}</div>
        </div>
      )}

      {/* Telegram Status */}
      {telegram && (
        <div className="mb-4 rounded-md border border-border bg-secondary/30 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Send className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">Telegram Notify</span>
            <StatusBadge status={telegram.sent ? "SENT" : telegram.skipped ? "SKIPPED" : "FAILED"} color={telegram.sent ? "profit" : telegram.skipped ? "warning" : "loss"} />
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {telegram.sent ? `gesendet (${telegram.latency_ms}ms)` : telegram.error || "nicht gesendet"}
          </div>
        </div>
      )}

      {/* OBSERVED — Market Intelligence */}
      {observed?.market_intelligence && (
        <div className="mb-4 rounded-md border border-border bg-secondary/20 p-3">
          <div className="mb-1 text-xs font-semibold text-muted-foreground">OBSERVED · Market Intelligence (Whale/Macro/News)</div>
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div>Whale: {observed.market_intelligence.whale_alerts?.available ? `${observed.market_intelligence.whale_alerts.count} tx` : "N/A"}</div>
            <div>Fear/Greed: {observed.market_intelligence.fear_greed ?? "N/A"}</div>
            <div>News: {observed.market_intelligence.news_count} items</div>
          </div>
        </div>
      )}

      {/* SCENARIO — Dry Test */}
      {scenario && (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">SCENARIO · Synthetischer A+-Dry-Test</span>
            <StatusBadge status={scenario.pass ? "PASS" : "FAIL"} color={scenario.pass ? "profit" : "loss"} />
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            Gate: {scenario.gate?.a_plus ? "A+ TRUE" : "BLOCKED"} · Card: {scenario.card?.card_status} · Telegram: {scenario.telegram?.sent ? "SENT" : scenario.telegram?.error}
          </div>
        </div>
      )}

      {/* Safety Counter */}
      {safety && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/20 px-3 py-2">
          <ShieldCheck className="h-3.5 w-3.5 text-profit" />
          <span className="font-mono text-xs text-muted-foreground">
            Safety-Counter: order_send={safety.order_send} · auto={safety.auto_execution} · live_orders={safety.live_orders_sent}
          </span>
        </div>
      )}
    </PanelCard>
  );
}

function CardField({ label, value, color = "muted" }) {
  const c = { muted: "text-foreground", profit: "text-profit", loss: "text-loss", primary: "text-primary" };
  return (
    <div className="rounded border border-border bg-secondary/50 px-2 py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${c[color]}`}>{value}</div>
    </div>
  );
}