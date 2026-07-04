import React, { useState } from "react";
import { Settings, Save, Bell, Send } from "lucide-react";
import { riskDefaults } from "@/lib/quantData";
import PanelCard from "@/components/PanelCard";
import StatusBadge from "@/components/StatusBadge";

export default function SettingsPage() {
  const [telegramConnected, setTelegramConnected] = useState(true);
  const [desktopNotif, setDesktopNotif] = useState(true);
  const [notifTypes, setNotifTypes] = useState({
    signals: true,
    governance: true,
    emergency: true,
    risk_warnings: true,
    daily_summary: false,
  });

  return (
    <div className="min-h-full p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Einstellungen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">System-Konfiguration – Notifications & Sicherheits-Einstellungen</p>
      </div>

      {/* Notifications */}
      <PanelCard title="Telegram & Desktop Notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${telegramConnected ? "bg-primary/10" : "bg-secondary"}`}>
                <Send className={`h-4 w-4 ${telegramConnected ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Telegram Bot</div>
                <div className="text-xs text-muted-foreground">{telegramConnected ? "Verbunden" : "Nicht verbunden"}</div>
              </div>
            </div>
            <button
              onClick={() => setTelegramConnected(!telegramConnected)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                telegramConnected ? "bg-loss/10 text-loss border border-loss/30 hover:bg-loss/20" : "bg-primary text-primary-foreground glow-cyan"
              }`}
            >
              {telegramConnected ? "Trennen" : "Verbinden"}
            </button>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${desktopNotif ? "bg-primary/10" : "bg-secondary"}`}>
                <Bell className={`h-4 w-4 ${desktopNotif ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Desktop-Benachrichtigungen</div>
                <div className="text-xs text-muted-foreground">Browser-Notifications aktivieren</div>
              </div>
            </div>
            <button
              onClick={() => setDesktopNotif(!desktopNotif)}
              className={`relative h-6 w-11 rounded-full transition-colors ${desktopNotif ? "bg-primary" : "bg-secondary"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${desktopNotif ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="rounded-md border border-border bg-secondary/30 p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">Benachrichtigungs-Typen</div>
            <div className="space-y-2">
              {Object.entries(notifTypes).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <button
                    onClick={() => setNotifTypes((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`relative h-5 w-9 rounded-full transition-colors ${val ? "bg-primary" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${val ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PanelCard>

      {/* Security */}
      <PanelCard title="Sicherheits-Einstellungen" className="mt-4">
        <div className="space-y-3">
          <SecurityRow label="API Secrets im Frontend" status="VERBOTEN" color="loss" />
          <SecurityRow label="Secrets via Environment Variables" status="AKTIV" color="profit" />
          <SecurityRow label="API Keys AES-256 verschlüsselt" status="AKTIV" color="profit" />
          <SecurityRow label="Testnet/Paper zuerst" status="ERZWUNGEN" color="profit" />
          <SecurityRow label="Kein Live-Trading ohne Governance" status="ERZWUNGEN" color="profit" />
          <SecurityRow label="Order-Reconciliation nach Timeout" status="AKTIV" color="profit" />
          <SecurityRow label="Rate-Limit Backoff" status="AKTIV" color="profit" />
          <SecurityRow label="Circuit Breaker bei Datenfehlern" status="AKTIV" color="profit" />
          <SecurityRow label="Emergency Stop blockiert neue Trades" status="AKTIV" color="profit" />
        </div>
      </PanelCard>

      {/* Capital Priority */}
      <PanelCard title="Kapitalerhalt" className="mt-4">
        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge status="CAPITAL PRESERVATION FIRST" color="warning" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Kapitalerhalt hat absoluten Vorrang. Daily Profit ist ein Ziel-KPI, kein Versprechen.
            Täglicher Gewinn kann nicht garantiert werden. Trading birgt Risiko des Totalverlusts.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">Risk Level</div>
            <div className="mt-1 font-mono text-sm font-bold text-primary">{riskDefaults.risk_level}</div>
          </div>
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">Risiko pro Trade</div>
            <div className="mt-1 font-mono text-sm font-bold text-foreground">{riskDefaults.risk_per_trade}%</div>
          </div>
          <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">High Leverage</div>
            <div className="mt-1 font-mono text-sm font-bold text-loss">{riskDefaults.high_leverage_mode}</div>
          </div>
        </div>
      </PanelCard>

      <div className="mt-4 flex justify-end">
        <button className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground glow-cyan">
          <Save className="h-4 w-4" />
          Einstellungen speichern
        </button>
      </div>
    </div>
  );
}

function SecurityRow({ label, status, color }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-4 py-2.5">
      <span className="text-sm text-foreground">{label}</span>
      <StatusBadge status={status} color={color} />
    </div>
  );
}