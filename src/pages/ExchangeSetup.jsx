import React, { useState, useEffect } from "react";
import { Plug, Lock, CheckCircle2, XCircle, Radio, RefreshCw, Globe, Ban } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { exchangeConnections } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import MetaTraderPanel from "@/components/mt5/MetaTraderPanel";

const phaseLabels = {
  DISABLED: "Deaktiviert",
  TESTNET_PAPER: "Phase 1 – Testnet/Paper",
  SHADOW: "Phase 2 – Shadow",
  LIVE: "Phase 3/4 – Live",
};

const phaseFlow = [
  { phase: "TESTNET_PAPER", label: "Phase 1: Binance Testnet/Paper", desc: "API Key verschlüsselt speichern, Paper-Trading aktivieren" },
  { phase: "SHADOW", label: "Phase 2: Binance Shadow", desc: "Shadow-Modus – Order-Simulation ohne Execution" },
  { phase: "LIVE", label: "Phase 3: Binance Live", desc: "Live-Trading nur mit Governance-Freigabe" },
  { phase: "LIVE", label: "Phase 4: MEXC Live", desc: "MEXC Live erst nach separater Governance-Freigabe" },
];

function formatPrice(n) {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(n) {
  if (typeof n !== "number") return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

export default function ExchangeSetup() {
  const [connections] = useState(exchangeConnections);
  const binance = connections.find((c) => c.exchange === "BINANCE");
  const mexc = connections.find((c) => c.exchange === "MEXC");

  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchLive = async () => {
    setLoading(true);
    try {
      const resp = await base44.functions.invoke("fetchExchangeData", {});
      setLiveData(resp.data || resp);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("fetchExchangeData failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-full p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            Exchange Setup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Exchange Router – Binance & MEXC Adapter-Konfiguration</p>
        </div>
        <button
          onClick={fetchLive}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-secondary/70 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Aktualisiere..." : "Daten aktualisieren"}
        </button>
      </div>

      {/* Live Ticker Panel */}
      <PanelCard
        title="Live Marktdaten – Binance & MEXC"
        action={
          lastUpdate && (
            <span className="font-mono text-xs text-muted-foreground">
              {lastUpdate.toLocaleTimeString("de-DE")} · Auto-Refresh 30s
            </span>
          )
        }
        className="mb-4"
      >
        {!liveData && loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Lade Live-Daten...</span>
          </div>
        )}

        {liveData && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Binance Live */}
            <ExchangeTickerCard
              name="Binance"
              data={liveData.binance}
            />
            {/* MEXC Live */}
            <ExchangeTickerCard
              name="MEXC"
              data={liveData.mexc}
            />
          </div>
        )}
      </PanelCard>

      {/* Security Warning */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 glow-amber">
        <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-warning">Sicherheitshinweis</p>
          <p className="mt-1 text-muted-foreground">
            API-Secrets werden niemals im Frontend gespeichert. Secrets nur über Environment Variables (.env) laden.
            API Keys werden AES-256 verschlüsselt in PostgreSQL gespeichert.
          </p>
        </div>
      </div>

      {/* Connection Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Binance */}
        <PanelCard title="Binance Adapter">
          <div className="mb-4 flex items-center justify-between">
            <StatusBadge status={phaseLabels[binance.phase]} color={binance.phase === "DISABLED" ? "loss" : "profit"} />
            <StatusBadge
              status={liveData?.binance?.reachable ? "LIVE ERREICHBAR" : "GEO-BLOCKED (451)"}
              color={liveData?.binance?.reachable ? "profit" : "loss"}
            />
          </div>

          <div className="space-y-2">
            <ConnRow label="Scan-Modul" ok={binance.scan_enabled} />
            <ConnRow label="Paper Trading" ok={binance.paper_enabled} />
            <ConnRow label="Shadow Mode" ok={binance.shadow_enabled} locked={!binance.shadow_enabled} />
            <ConnRow label="Live Trading" ok={binance.live_enabled} locked />
          </div>

          <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">API Key ID</div>
            <div className="mt-1 font-mono text-sm text-foreground">{binance.api_key_id || "Nicht konfiguriert"}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Letzter Sync: {binance.last_sync ? new Date(binance.last_sync).toLocaleString("de-DE") : "—"}
            </div>
            {liveData?.binance && !liveData.binance.reachable && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-loss">
                <Ban className="h-3 w-3" />
                {liveData.binance.error || "Nicht erreichbar"}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/70">
              Testnet Verbinden
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
              <Lock className="h-3.5 w-3.5" />
              Shadow aktivieren
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm font-semibold text-loss">
              <Lock className="h-3.5 w-3.5" />
              Live aktivieren
            </button>
          </div>
        </PanelCard>

        {/* MEXC */}
        <PanelCard title="MEXC Adapter">
          <div className="mb-4 flex items-center justify-between">
            <StatusBadge status={phaseLabels[mexc.phase]} color="muted" />
            <StatusBadge
              status={liveData?.mexc?.reachable ? "LIVE ERREICHBAR" : "OFFLINE"}
              color={liveData?.mexc?.reachable ? "profit" : "loss"}
            />
          </div>

          <div className="space-y-2">
            <ConnRow label="Scan-Modul" ok={mexc.scan_enabled} />
            <ConnRow label="Paper Trading" ok={mexc.paper_enabled} locked={!mexc.paper_enabled} />
            <ConnRow label="Shadow Mode" ok={mexc.shadow_enabled} locked />
            <ConnRow label="Live Trading" ok={mexc.live_enabled} locked />
          </div>

          <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="mt-1 text-sm text-foreground">
              MEXC ist als reines Scan/Paper-Modul aktiviert. Live-Trading erst nach separater Governance-Freigabe.
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              Scan-Modul aktivieren
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm font-semibold text-loss">
              <Lock className="h-3.5 w-3.5" />
              Live (gesperrt)
            </button>
          </div>
        </PanelCard>
      </div>

      {/* Vantage / MetaTrader 5 Integration */}
      <MetaTraderPanel className="mt-4" />

      {/* Phase Flow */}
      <PanelCard title="Phasen-Migration" className="mt-4">
        <div className="space-y-3">
          {phaseFlow.map((p, i) => (
            <div key={i} className="flex items-start gap-4 rounded-md border border-border bg-secondary/30 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-heading text-sm font-semibold text-foreground">{p.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
              </div>
              {(i === 0 && binance.phase === "TESTNET_PAPER") ? (
                <StatusBadge status="AKTIV" color="profit" />
              ) : i >= 2 ? (
                <StatusBadge status="GESPERRT" color="loss" />
              ) : (
                <StatusBadge status="OFFEN" color="muted" />
              )}
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Circuit Breaker & Rate Limit */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard title="Circuit Breaker Status">
          <div className="space-y-2">
            <ConnRow label="Binance Circuit Breaker" ok={!binance.circuit_breaker_active} />
            <ConnRow label="MEXC Circuit Breaker" ok={!mexc.circuit_breaker_active} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Bei 3 Datenfehlern → Pause 60 Sekunden. Order-Reconciliation nach Trade-Timeout.
          </p>
        </PanelCard>

        <PanelCard title="Rate-Limit Backoff">
          <div className="space-y-2">
            <ConnRow
              label="Binance API Rate"
              ok={liveData?.binance?.rate_limit_status === "OK"}
            />
            <ConnRow
              label="MEXC API Rate"
              ok={liveData?.mexc?.rate_limit_status === "OK"}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Automatischer Backoff bei Erreichen von Rate-Limits. Exponentieller Retry mit Jitter.
          </p>
        </PanelCard>
      </div>
    </div>
  );
}

function ExchangeTickerCard({ name, data }) {
  const reachable = data?.reachable;
  const tickers = data?.tickers || [];

  return (
    <div className={`rounded-lg border p-4 ${reachable ? "border-profit/30 bg-profit/5" : "border-loss/30 bg-loss/5"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className={`h-4 w-4 ${reachable ? "text-profit" : "text-loss"}`} />
          <span className="font-heading text-sm font-bold text-foreground">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          {reachable ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-profit">
              <Radio className="h-3 w-3" /> LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-loss">
              <Ban className="h-3 w-3" /> OFFLINE
            </span>
          )}
          {data?.latency_ms != null && reachable && (
            <span className="font-mono text-xs text-muted-foreground">{data.latency_ms}ms</span>
          )}
        </div>
      </div>

      {!reachable && data?.error && (
        <div className="mb-3 rounded-md border border-loss/20 bg-loss/10 px-3 py-2 text-xs text-loss">
          {data.error}
        </div>
      )}

      {reachable && tickers.length > 0 ? (
        <div className="space-y-2">
          {tickers.map((t) => (
            <div key={t.symbol} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
              <span className="font-mono text-sm font-semibold text-foreground">{t.symbol}</span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-foreground">${formatPrice(t.last_price)}</span>
                <span className={`font-mono text-xs font-semibold ${t.price_change_pct >= 0 ? "text-profit" : "text-loss"}`}>
                  {t.price_change_pct >= 0 ? "+" : ""}{t.price_change_pct.toFixed(2)}%
                </span>
                <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                  Vol: {formatVolume(t.quote_volume_24h)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : reachable ? (
        <div className="py-4 text-center text-xs text-muted-foreground">Keine Ticker-Daten verfügbar</div>
      ) : null}
    </div>
  );
}

function ConnRow({ label, ok, locked }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {locked && <Lock className="h-3 w-3 text-warning" />}
        {ok ? <CheckCircle2 className="h-4 w-4 text-profit" /> : <XCircle className="h-4 w-4 text-loss" />}
        <span className={`font-mono text-xs font-semibold ${ok ? "text-profit" : "text-muted-foreground"}`}>
          {ok ? "AKTIV" : "INAKTIV"}
        </span>
      </div>
    </div>
  );
}