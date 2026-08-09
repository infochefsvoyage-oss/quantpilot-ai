import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { symbolMappingCandidates } from "@/lib/mt5Data";

export default function MT5SymbolMapping() {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Symbol Mapping</span>
        <span className="text-[11px] text-muted-foreground">Vantage MT5-Feed – nicht validiert</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="pb-2 text-left font-medium">QuantPilot</th>
              <th className="pb-2 text-left font-medium">MT5-Kandidaten</th>
              <th className="pb-2 text-left font-medium">Aufgelöst</th>
              <th className="pb-2 text-center font-medium">Validiert</th>
              <th className="pb-2 text-right font-medium">Contract / Tick</th>
            </tr>
          </thead>
          <tbody>
            {symbolMappingCandidates.map((m) => (
              <tr key={m.canonical} className="border-b border-border/40">
                <td className="py-2 font-mono font-semibold text-foreground">{m.canonical}</td>
                <td className="py-2 font-mono text-muted-foreground">{m.candidates.join(" · ")}</td>
                <td className="py-2 font-mono text-muted-foreground">{m.resolved ?? "—"}</td>
                <td className="py-2 text-center">
                  {m.validated ? (
                    <CheckCircle2 className="mx-auto h-4 w-4 text-profit" />
                  ) : (
                    <XCircle className="mx-auto h-4 w-4 text-loss" />
                  )}
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground">
                  {m.contract_size} / {m.tick_size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Das tatsächliche MT5-Symbol wird vom Vantage-Feed ermittelt, nicht angenommen.
        Mapping gilt erst als validiert, wenn das Backend das Symbol im Terminal bestätigt.
      </p>
    </div>
  );
}