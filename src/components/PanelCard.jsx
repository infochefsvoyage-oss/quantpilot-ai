import React from "react";

export default function PanelCard({ title, children, className = "", action = null }) {
  return (
    <div className={`rounded-lg border border-border bg-card ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}