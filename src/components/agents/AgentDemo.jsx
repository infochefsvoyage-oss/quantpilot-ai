import React, { useState } from "react";
import { Bot, Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PanelCard from "@/components/PanelCard";

const PROMPT = `Analysiere die aktuelle SOLUSDT SHORT Live-Position (Trade ID: 6a50b43ae1a3bb7d2f526151), die seit dem 10.07.2026 offen ist. 
Entry: 79.50, SL: 83.50, TP: 67.50, Size: 12.5 SOL, Risiko: $50 (0.5% Equity).
Aktueller Preis ~81.03, unrealisierter Verlust -$19.13.

Bewerte:
1. Ist das Setup noch valide oder sollte der Trade geschlossen werden?
2. Welche Optimierungspotenziale siehst du für das Trading-System?
3. Welche nächsten Schritte empfiehlst du für die Go-Live-Readiness?`;

const AGENTS = [
  {
    id: "chief_architect",
    label: "Chief Architect",
    icon: Bot,
    description: "Systemarchitektur & Codequalität",
  },
  {
    id: "quant_research",
    label: "Quant Research",
    icon: Bot,
    description: "Strategien, Backtests & Statistik",
  },
  {
    id: "market_intelligence",
    label: "Market Intelligence",
    icon: Bot,
    description: "Makroanalyse & Marktregime",
  },
  {
    id: "execution_agent",
    label: "Execution Agent",
    icon: Bot,
    description: "Sniper-Setups & Order-Management",
  },
  {
    id: "optimization_agent",
    label: "Optimization Agent",
    icon: Bot,
    description: "Performance & Refactoring",
  },
  {
    id: "governance_ulf",
    label: "Governance (ULF)",
    icon: Bot,
    description: "Freigaben, Audit & Sicherheit",
  },
];

export default function AgentDemo() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const runAgent = async (agentId) => {
    setLoading((prev) => ({ ...prev, [agentId]: true }));
    setResults((prev) => ({ ...prev, [agentId]: null }));
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${PROMPT}\n\nDu bist der ${AGENTS.find((a) => a.id === agentId).label}. Antworte präzise und datengetrieben auf Deutsch.`,
        model: "claude_sonnet_4_6",
      });
      setResults((prev) => ({ ...prev, [agentId]: response }));
    } catch (err) {
      setResults((prev) => ({ ...prev, [agentId]: `Fehler: ${err.message}` }));
    } finally {
      setLoading((prev) => ({ ...prev, [agentId]: false }));
    }
  };

  const runAll = async () => {
    await Promise.all(AGENTS.map((a) => runAgent(a.id)));
  };

  const anyLoading = Object.values(loading).some((v) => v);
  const completedCount = Object.values(results).filter((v) => v && !v.startsWith("Fehler:")).length;

  return (
    <div className="space-y-4">
      <PanelCard
        title="Multi-Agent Analyse — SOLUSDT SHORT Position"
        action={
          <button
            onClick={runAll}
            disabled={anyLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 glow-cyan"
          >
            {anyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {anyLoading ? `Analysiere… (${completedCount}/6)` : "Alle Agenten starten"}
          </button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            6 spezialisierte Sub-Agenten analysieren die offene SOLUSDT SHORT Position und das Trading-System unabhängig voneinander.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {AGENTS.map((agent) => {
              const result = results[agent.id];
              const isLoading = loading[agent.id];
              return (
                <div
                  key={agent.id}
                  className="rounded-md border border-border bg-secondary/30 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <agent.icon className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{agent.label}</span>
                    </div>
                    {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {result && !isLoading && !result.startsWith("Fehler:") && (
                      <span className="h-2 w-2 rounded-full bg-profit" />
                    )}
                    {result && result.startsWith("Fehler:") && (
                      <span className="h-2 w-2 rounded-full bg-loss" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{agent.description}</p>
                  {!result && !isLoading && (
                    <button
                      onClick={() => runAgent(agent.id)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      Analysieren
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PanelCard>

      {AGENTS.map((agent) => {
        const result = results[agent.id];
        if (!result) return null;
        return (
          <PanelCard
            key={agent.id}
            title={agent.label}
            action={
              <span className={`h-2 w-2 rounded-full ${result.startsWith("Fehler:") ? "bg-loss" : "bg-profit"}`} />
            }
          >
            {result.startsWith("Fehler:") ? (
              <p className="text-sm text-loss">{result}</p>
            ) : (
              <div className="text-sm text-foreground whitespace-pre-wrap">{result}</div>
            )}
          </PanelCard>
        );
      })}
    </div>
  );
}