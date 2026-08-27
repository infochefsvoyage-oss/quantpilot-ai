import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Radar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Activity,
  ShieldAlert,
  Database,
  Gauge,
} from "lucide-react";

import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";
import {
  arbOpportunities,
  arbRegimeStats,
  arbExchangeStatus,
  arbStatusMeta,
  regimeMeta,
} from "@/lib/extendedData";

const AUTO_ORDER = false;

const DATA_HEALTH = {
  status: "DEGRADED",
  critical: true,
  http500: true,
  http502: true,
  http403: true,
};

const REQUIRED_OPPORTUNITIES = 100;

export default function ArbScan() {
  const [filterRegime, setFilterRegime] = useState("ALL");
  const [filterProfitable, setFilterProfitable] = useState(false);
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    let active = true;
    base44.entities.ArbOpportunity.list("-created_date", 500)
      .then((records) => {
        if (!active) return;
        const normalized = Array.isArray(records) ? records : [];
        setLiveData({
          opportunities: normalized,
          data_health: summarizeDataHealth(normalized),
          feed_health: summarizeFeedHealth(normalized),
          pipeline: buildMeasurementPipeline(normalized),
        });
      })
      .catch(() => {
        if (active) setLiveData(null);
      });
    return () => { active = false; };
  }, []);

  const opportunities = Array.isArray(liveData?.opportunities)
    ? liveData.opportunities
    : Array.isArray(arbOpportunities)
      ? arbOpportunities
      : [];

  const filtered = useMemo(() => {
    return opportunities.filter((opp) => {
      if (
        filterRegime !== "ALL" &&
        opp.market_regime !== filterRegime
      ) {
        return false;
      }

      if (
        filterProfitable &&
        !isActuallyEligibleForProfitDisplay(opp)
      ) {
        return false;
      }

      return true;
    });
  }, [opportunities, filterRegime, filterProfitable]);

  const totalAlerted = opportunities.filter(
    (opp) => opp.telegram_alert_sent
  ).length;

  const totalProfitable = opportunities.filter(
    (opp) => isActuallyEligibleForProfitDisplay(opp)
  ).length;

  const totalGovernancePending = opportunities.filter(
    (opp) => opp.status === "GOVERNANCE_PENDING"
  ).length;

  const completedOpportunities = opportunities.filter(
    isCompletedOpportunity
  ).length;

  const captureRate = calculateCaptureRate(opportunities);
  const dataSource = liveData ? "BASE44" : "LOCAL_FALLBACK";
  const pipeline = liveData?.pipeline || buildMeasurementPipeline(opportunities);
  const feedHealth = liveData?.feed_health || summarizeFeedHealth(opportunities);

  const captureReady =
    completedOpportunities >= REQUIRED_OPPORTUNITIES &&
    captureRate !== null;

  return (
    <div className="min-h-full p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
              <Radar className="h-6 w-6 text-primary" />
              ARB-Scan
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Multi-Exchange Arbitrage Measurement Track —
              Research/Paper, kein Live-Ordering
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge
              status={`DATA ${liveData?.data_health || DATA_HEALTH.status}`}
              color={liveData?.data_health === "HEALTHY" ? "profit" : "warning"}
            />

            <StatusBadge
              status={`SOURCE ${dataSource}`}
              color={liveData ? "profit" : "warning"}
            />

            <StatusBadge
              status="AUTO ORDER OFF"
              color="loss"
            />
          </div>
        </div>
      </div>

      {/* Master Safety Banner */}
      <div className="rounded-lg border border-loss/30 bg-loss/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-loss" />

          <div>
            <p className="text-sm font-semibold text-loss">
              V1.2 Master Risk Gate: LIVE ORDERING GESPERRT
            </p>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              DATA_HEALTH ist aktuell DEGRADED. HTTP 500, 502 und
              403 auf kritischen Datenpfaden verhindern eine
              belastbare Execution-Messung. AUTO_ORDER bleibt
              technisch FALSE.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Radar}
          label="Opportunities"
          value={opportunities.length}
          color="cyan"
        />

        <KpiCard
          icon={AlertTriangle}
          label="Alerts gesendet"
          value={totalAlerted}
          color="warning"
        />

        <KpiCard
          icon={CheckCircle2}
          label="Nach Kosten positiv"
          value={totalProfitable}
          color="profit"
        />

        <KpiCard
          icon={Gauge}
          label="Capture Rate"
          value={
            captureReady
              ? `${captureRate.toFixed(1)}%`
              : "N/A"
          }
          color={captureReady ? "profit" : "loss"}
        />
      </div>

      {/* Measurement Status */}
      <PanelCard title="V1.2 Measurement Status" className="mt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <HealthCard
            label="RESEARCH"
            status="GO"
            color="profit"
          />

          <HealthCard
            label="DATA COLLECTION"
            status="DEGRADED"
            color="warning"
          />

          <HealthCard
            label="PAPER"
            status="BLOCKED"
            color="loss"
          />

          <HealthCard
            label="MICRO LIVE"
            status="BLOCKED"
            color="loss"
          />

          <HealthCard
            label="AUTO ORDER"
            status="BLOCKED"
            color="loss"
          />
        </div>
      </PanelCard>

      {/* Feed Health */}
      <PanelCard title="Market Data Health" className="mt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FeedHealthCard
            label="HTTP 500"
            description="Top-Gainer / Loser"
            failed={feedHealth.http500}
          />

          <FeedHealthCard
            label="HTTP 502"
            description="Broker / MT5 / Upstream"
            failed={feedHealth.http502}
          />

          <FeedHealthCard
            label="HTTP 403"
            description="Trend / Perp Feeds"
            failed={feedHealth.http403}
          />
        </div>
      </PanelCard>

      {/* Measurement Pipeline */}
      <PanelCard title="V1.2 Measurement Pipeline" className="mt-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5 lg:grid-cols-9">
          {pipeline.map((stage) => (
            <div key={stage.name} className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-[10px] font-semibold text-muted-foreground">{stage.name}</div>
              <div className="mt-2"><StatusBadge status={stage.status} color={stage.status === "PASS" ? "profit" : stage.status === "BLOCKED" ? "loss" : "warning"} /></div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Fail-closed: ungeprüfte Health-, Freshness-, Clock-Sync- oder Cost-Daten werden nicht als statistisch belastbare Execution gewertet.</p>
      </PanelCard>

      {/* Exchange Status */}
      <PanelCard
        title="Exchange-Verbindungen (CCXT)"
        className="mt-4"
      >
        {arbExchangeStatus.length === 0 ? (
          <EmptyState text="Keine Exchange-Health-Daten verfügbar." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {arbExchangeStatus.map((ex) => {
              const latency = safeNumber(ex.latency_ms);
              const rateLimit = safeNumber(
                ex.rate_limit_percent
              );

              const healthy =
                ex.status === "CONNECTED" &&
                latency !== null &&
                latency <= 200;

              return (
                <div
                  key={ex.exchange}
                  className="rounded-lg border border-border bg-secondary/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-foreground">
                      {ex.exchange}
                    </span>

                    <StatusBadge
                      status={ex.status || "UNKNOWN"}
                      color={
                        healthy
                          ? "profit"
                          : ex.status === "DEGRADED"
                            ? "warning"
                            : "loss"
                      }
                    />
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <MetricRow
                      label="Latenz"
                      value={
                        latency !== null
                          ? `${latency}ms`
                          : "N/A"
                      }
                      color={
                        latency !== null && latency <= 200
                          ? "text-foreground"
                          : "text-warning"
                      }
                    />

                    <MetricRow
                      label="Symbole"
                      value={ex.symbols_scanned ?? "N/A"}
                    />

                    <MetricRow
                      label="Rate Limit"
                      value={
                        rateLimit !== null
                          ? `${rateLimit}%`
                          : "N/A"
                      }
                      color={
                        rateLimit === null
                          ? "text-muted-foreground"
                          : rateLimit > 80
                            ? "text-loss"
                            : rateLimit > 60
                              ? "text-warning"
                              : "text-profit"
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>

      {/* Regime Stats */}
      <PanelCard
        title="Markt-Regime Klassifizierung"
        className="mt-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Object.entries(arbRegimeStats).map(
            ([regime, stats = {}]) => {
              const meta = regimeMeta[regime] || {
                color: "warning",
                desc: "Keine Regimebeschreibung verfügbar.",
              };

              return (
                <div
                  key={regime}
                  className="rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge
                      status={regime}
                      color={meta.color}
                    />

                    <span className="font-mono text-xs text-muted-foreground">
                      {stats.count ?? 0} Scans
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <MetricRow
                      label="Ø Spread"
                      value={
                        stats.avg_spread !== undefined
                          ? `${stats.avg_spread}%`
                          : "N/A"
                      }
                    />

                    <MetricRow
                      label="Profitabel"
                      value={stats.profitable ?? 0}
                      color={
                        stats.profitable > 0
                          ? "text-profit"
                          : "text-muted-foreground"
                      }
                    />
                  </div>

                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {meta.desc}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </PanelCard>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Filter:
        </span>

        {[
          "ALL",
          "CALM",
          "VOLATILE",
          "TRENDING",
          "ILLIQUID",
          "EXTREME",
        ].map((regime) => (
          <button
            key={regime}
            type="button"
            onClick={() => setFilterRegime(regime)}
            className={`rounded-md border px-3 py-1 font-mono text-xs transition-colors ${
              filterRegime === regime
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {regime}
          </button>
        ))}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={filterProfitable}
            onChange={(event) =>
              setFilterProfitable(event.target.checked)
            }
            className="accent-primary"
          />

          Nur nach Kosten positiv
        </label>
      </div>

      {/* Opportunity Table */}
      <PanelCard
        title={`Arbitrage-Opportunities (${filtered.length})`}
        className="mt-4"
      >
        {filtered.length === 0 ? (
          <EmptyState text="Keine Opportunities für die aktuellen Filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">
                    Symbol
                  </th>

                  <th className="px-3 py-2 text-left font-medium">
                    Route
                  </th>

                  <th className="px-3 py-2 text-right font-medium">
                    Raw
                  </th>

                  <th className="px-3 py-2 text-right font-medium">
                    Fees
                  </th>

                  <th className="px-3 py-2 text-right font-medium">
                    Slip.
                  </th>

                  <th className="px-3 py-2 text-right font-medium">
                    Adverse
                  </th>

                  <th className="px-3 py-2 text-right font-medium">
                    Inventory
                  </th>

                  <th className="px-3 py-2 text-right font-medium">
                    Netto
                  </th>

                  <th className="px-3 py-2 text-left font-medium">
                    Regime
                  </th>

                  <th className="px-3 py-2 text-left font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((opp) => (
                  <OpportunityRow
                    key={opp.id}
                    opportunity={opp}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {/* Capture Rate */}
      <PanelCard
        title="Capture Rate / Statistical Gate"
        className="mt-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricBox
            icon={Activity}
            label="Echte Opportunities"
            value={completedOpportunities}
            suffix={` / ${REQUIRED_OPPORTUNITIES}`}
          />

          <MetricBox
            icon={TrendingUp}
            label="Capture Rate"
            value={
              captureRate !== null
                ? captureRate.toFixed(2)
                : "N/A"
            }
            suffix={
              captureRate !== null ? "%" : ""
            }
          />

          <MetricBox
            icon={ShieldAlert}
            label="Statistical Gate"
            value={captureReady ? "READY" : "BLOCKED"}
            suffix=""
            danger={!captureReady}
          />
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Capture Rate wird erst als belastbar betrachtet, wenn
          mindestens 100 echte, nicht resampelte Opportunities mit
          theoretischem und realisiertem Netto-P&L vorliegen.
          Datenfehler, veraltete Quotes und nicht ausführbare
          Opportunities dürfen nicht als erfolgreiche Execution
          gewertet werden.
        </p>
      </PanelCard>

      {/* Governance */}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />

        <div>
          <p className="text-sm font-semibold text-warning">
            Governance / Execution
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Dieser Scanner ist aktuell eine Measurement-Track-
            Oberfläche. Eine Opportunity-Anzeige stellt keine
            Handelsfreigabe dar. AUTO_ORDER bleibt{" "}
            <code className="font-mono text-loss">
              FALSE
            </code>
            .
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge
              status="RESEARCH: GO"
              color="profit"
            />

            <StatusBadge
              status="DATA: DEGRADED"
              color="warning"
            />

            <StatusBadge
              status="PAPER: BLOCKED"
              color="loss"
            />

            <StatusBadge
              status="LIVE: BLOCKED"
              color="loss"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                  */
/* -------------------------------------------------------------------------- */

function OpportunityRow({ opportunity: opp }) {
  const rawSpread = safeNumber(opp.raw_spread_percent);
  const fee = safeNumber(opp.taker_fee_percent);
  const slippage = safeNumber(
    opp.estimated_slippage_percent
  );

  const adverseSelection = safeNumber(
    opp.adverse_selection_cost_percent
  );

  const inventoryCost = safeNumber(
    opp.inventory_imbalance_cost_percent
  );

  const netProfit = safeNumber(
    opp.net_profit_percent
  );

  const regime =
    regimeMeta[opp.market_regime] || {
      color: "warning",
    };

  const status =
    arbStatusMeta[opp.status] || {
      label: opp.status || "UNKNOWN",
      color: "warning",
    };

  const profitDisplayAllowed =
    isActuallyEligibleForProfitDisplay(opp);

  return (
    <tr className="border-b border-border/50 hover:bg-secondary/20">
      <td className="px-3 py-3 font-mono font-semibold text-foreground">
        {opp.symbol || "N/A"}
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono text-profit">
            {opp.buy_exchange || "?"}
          </span>

          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />

          <span className="font-mono text-loss">
            {opp.sell_exchange || "?"}
          </span>
        </div>
      </td>

      <td className="px-3 py-3 text-right font-mono text-foreground">
        {formatPercent(rawSpread)}
      </td>

      <td className="px-3 py-3 text-right font-mono text-muted-foreground">
        {formatPercent(fee)}
      </td>

      <td className="px-3 py-3 text-right font-mono text-muted-foreground">
        {formatPercent(slippage)}
      </td>

      <td className="px-3 py-3 text-right font-mono text-warning">
        {formatPercent(adverseSelection)}
      </td>

      <td className="px-3 py-3 text-right font-mono text-warning">
        {formatPercent(inventoryCost)}
      </td>

      <td
        className={`px-3 py-3 text-right font-mono font-bold ${
          !profitDisplayAllowed
            ? "text-muted-foreground"
            : netProfit !== null && netProfit >= 0
              ? "text-profit"
              : "text-loss"
        }`}
      >
        {!profitDisplayAllowed
          ? "BLOCKED"
          : formatSignedPercent(netProfit)}
      </td>

      <td className="px-3 py-3">
        <StatusBadge
          status={opp.market_regime || "UNKNOWN"}
          color={regime.color}
        />
      </td>

      <td className="px-3 py-3">
        <StatusBadge
          status={status.label}
          color={status.color}
        />
      </td>
    </tr>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}) {
  const colors = {
    profit:
      "text-profit bg-profit/10 border-profit/20",
    loss:
      "text-loss bg-loss/10 border-loss/20",
    warning:
      "text-warning bg-warning/10 border-warning/20",
    cyan:
      "text-primary bg-primary/10 border-primary/20",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div
        className={`mb-3 inline-flex rounded-md border p-2 ${
          colors[color] || colors.cyan
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="font-mono text-2xl font-bold text-foreground">
        {value}
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function HealthCard({
  label,
  status,
  color,
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="text-[10px] font-semibold text-muted-foreground">
        {label}
      </div>

      <div className="mt-2">
        <StatusBadge
          status={status}
          color={color}
        />
      </div>
    </div>
  );
}

function FeedHealthCard({
  label,
  description,
  failed,
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />

          <span className="font-mono text-sm font-semibold text-foreground">
            {label}
          </span>
        </div>

        {failed ? (
          <XCircle className="h-4 w-4 text-loss" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-profit" />
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {description}
      </p>

      <div
        className={`mt-3 text-xs font-semibold ${
          failed ? "text-loss" : "text-profit"
        }`}
      >
        {failed ? "DEGRADED" : "HEALTHY"}
      </div>
    </div>
  );
}

function MetricBox({
  icon: Icon,
  label,
  value,
  suffix,
  danger = false,
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      <div
        className={`mt-2 font-mono text-2xl font-bold ${
          danger ? "text-loss" : "text-foreground"
        }`}
      >
        {value}
        <span className="ml-1 text-sm text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  color = "text-foreground",
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span className={`font-mono ${color}`}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Activity className="h-8 w-8 text-muted-foreground" />

      <p className="mt-3 text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function safeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value) {
  return value === null
    ? "N/A"
    : `${value.toFixed(3)}%`;
}

function formatSignedPercent(value) {
  if (value === null) return "N/A";

  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`;
}

function isCompletedOpportunity(opp) {
  return [
    "COMPLETED",
    "EXECUTED",
    "PAPER_COMPLETED",
  ].includes(opp.status);
}

function isActuallyEligibleForProfitDisplay(opp) {
  if (!opp) return false;

  /*
   * Fail closed:
   * A positive calculated spread is not enough when the
   * opportunity is stale, unhealthy or blocked.
   */
  if (opp.source_type === "RESEARCH_DEX") return false;
  if (opp.data_health !== "HEALTHY") return false;
  if (opp.feed_health && opp.feed_health !== "HEALTHY") return false;
  if (opp.execution_health === "FALSE") return false;
  if (opp.broker_health === "FALSE") return false;

  if (opp.freshness_valid === false) return false;
  if (opp.clock_sync_valid === false) return false;
  if (opp.adverse_selection_gate === "REJECT") return false;
  if (opp.inventory_gate === "REJECT") return false;

  return (
    opp.is_profitable_after_costs === true &&
    safeNumber(opp.net_profit_percent) !== null
  );
}

function summarizeDataHealth(opportunities) {
  if (opportunities.length === 0) return "DEGRADED";
  if (opportunities.some(o => o.data_health === "FAILED")) return "DEGRADED";
  return opportunities.every(o => o.data_health === "HEALTHY") ? "HEALTHY" : "DEGRADED";
}

function buildMeasurementPipeline(opportunities) {
  return [
    { name: "RAW OPPORTUNITY", status: opportunities.length > 0 ? "PASS" : "BLOCKED" },
    { name: "DATA HEALTH", status: summarizeDataHealth(opportunities) === "HEALTHY" ? "PASS" : "DEGRADED" },
    { name: "FRESHNESS / LATENCY", status: opportunities.length > 0 && opportunities.every(o => o.freshness_valid !== false) ? "PASS" : "BLOCKED" },
    { name: "CLOCK-SYNC", status: opportunities.length > 0 && opportunities.every(o => o.clock_sync_valid !== false) ? "PASS" : "BLOCKED" },
    { name: "ORDERBOOK SLIPPAGE", status: opportunities.length > 0 && opportunities.every(o => o.orderbook_slippage_valid !== false) ? "PASS" : "BLOCKED" },
    { name: "TRADING FEES", status: opportunities.length > 0 ? "PASS" : "BLOCKED" },
    { name: "ADVERSE / INVENTORY", status: opportunities.length > 0 && opportunities.every(o => o.adverse_selection_gate === "PASS" && o.inventory_gate === "PASS") ? "PASS" : "BLOCKED" },
    { name: "NET-PROFIT", status: opportunities.some(isActuallyEligibleForProfitDisplay) ? "PASS" : "BLOCKED" },
    { name: "MASTER RISK / PAPER", status: "BLOCKED" },
    { name: "CAPTURE ≥100", status: opportunities.filter(isGenuineOpportunity).length >= REQUIRED_OPPORTUNITIES ? "PASS" : "BLOCKED" },
    { name: "STATISTICAL AUDIT", status: "BLOCKED" },
  ];
}

function summarizeFeedHealth(opportunities) {
  return {
    http500: opportunities.some(o => o.feed_health === "HTTP_500" || o.http_status === 500) || DATA_HEALTH.http500,
    http502: opportunities.some(o => o.feed_health === "HTTP_502" || o.http_status === 502) || DATA_HEALTH.http502,
    http403: opportunities.some(o => o.feed_health === "HTTP_403" || o.http_status === 403) || DATA_HEALTH.http403,
  };
}

function isGenuineOpportunity(opp) {
  return !!opp && opp.source_type === "LIVE_CEX" && opp.status !== "MOCK" && opp.dex_execution_mode !== "RESEARCH_ONLY";
}

function calculateCaptureRate(opportunities) {
  const valid = opportunities.filter(
    (opp) =>
      isGenuineOpportunity(opp) &&
      isCompletedOpportunity(opp) &&
      opp.capture_eligible === true &&
      opp.data_health === "HEALTHY" &&
      opp.freshness_valid === true &&
      opp.clock_sync_valid === true &&
      opp.orderbook_slippage_valid === true &&
      opp.adverse_selection_gate === "PASS" &&
      opp.inventory_gate === "PASS" &&
      safeNumber(opp.theoretical_net_profit) !== null &&
      safeNumber(opp.realized_net_profit) !== null
  );

  if (valid.length < REQUIRED_OPPORTUNITIES) {
    return null;
  }

  const theoretical = valid.reduce(
    (sum, opp) =>
      sum + Number(opp.theoretical_net_profit),
    0
  );

  const realized = valid.reduce(
    (sum, opp) =>
      sum + Number(opp.realized_net_profit),
    0
  );

  if (!Number.isFinite(theoretical) || theoretical <= 0) {
    return null;
  }

  return (realized / theoretical) * 100;
}