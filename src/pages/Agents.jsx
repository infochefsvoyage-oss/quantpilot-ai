import React, { useState } from "react";
import {
  Building2, FlaskConical, Globe, Crosshair, Wrench, ShieldCheck, Bot,
} from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";

const AGENTS = [
  {
    id: "chief_architect",
    label: "Chief Architect",
    icon: Building2,
    description: "Systemarchitektur, Codequalität & modulare Struktur",
    color: "text-primary",
  },
  {
    id: "quant_research",
    label: "Quant Research",
    icon: FlaskConical,
    description: "Strategien, Backtests & statistische Auswertung",
    color: "text-chart-1",
  },
  {
    id: "market_intelligence",
    label: "Market Intelligence",
    icon: Globe,
    description: "Makroanalyse, News & Marktregime-Erkennung",
    color: "text-chart-4",
  },
  {
    id: "execution_agent",
    label: "Execution Agent",
    icon: Crosshair,
    description: "Sniper-Setups, Entry/Exit & Order-Management",
    color: "text-warning",
  },
  {
    id: "optimization_agent",
    label: "Optimization Agent",
    icon: Wrench,
    description: "Performance, Refactoring & technische Schulden",
    color: "text-chart-2",
  },
  {
    id: "governance_ulf",
    label: "Governance (ULF)",
    icon: ShieldCheck,
    description: "Freigaben, Audit-Logs & Sicherheitsregeln",
    color: "text-loss",
  },
];

export default function Agents() {
  const [selectedId, setSelectedId] = useState(AGENTS[0].id);
  const selected = AGENTS.find((a) => a.id === selectedId);

  return (
    <div className="flex h-full">
      {/* Agent selector sidebar */}
      <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto scrollbar-thin">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-sm font-bold text-foreground">Agenten Desk</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            6 spezialisierte Sub-Agenten — eigenständig, datengetrieben
          </p>
        </div>
        <nav className="py-2">
          {AGENTS.map((agent) => {
            const active = agent.id === selectedId;
            const Icon = agent.icon;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedId(agent.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-l-2 border-primary bg-secondary/50"
                    : "border-l-2 border-transparent hover:bg-secondary/30"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${active ? agent.color : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    {agent.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {agent.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AgentChat agent={{ ...selected, id: selected.id }} />
      </div>
    </div>
  );
}