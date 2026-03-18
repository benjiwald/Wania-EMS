"use client";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export interface AlertData {
  id: string; siteName: string; severity: "info" | "warning" | "critical";
  message: string | null; createdAt: string;
}

function getSeverityConfig(severity: string) {
  if (severity === "critical") return {
    icon: <AlertCircle className="h-4 w-4 text-status-offline" />,
    border: "border-l-status-offline", label: "Kritisch",
    badge: "bg-status-offline/10 text-status-offline border-status-offline/20",
  };
  if (severity === "warning") return {
    icon: <AlertTriangle className="h-4 w-4 text-status-warning" />,
    border: "border-l-status-warning", label: "Warnung",
    badge: "bg-status-warning/10 text-status-warning border-status-warning/20",
  };
  return {
    icon: <Info className="h-4 w-4 text-status-info" />,
    border: "border-l-status-info", label: "Info",
    badge: "bg-status-info/10 text-status-info border-status-info/20",
  };
}

export default function AlertsPanel({ alerts }: { alerts: AlertData[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aktive Alarme</h2>
        {alerts.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-[10px] font-bold text-destructive border border-destructive/20">
            {alerts.length}
          </span>
        )}
      </div>

      <div className="max-h-[340px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-status-online/10 border border-status-online/20">
              <CheckCircle2 className="h-5 w-5 text-status-online" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Alles in Ordnung</p>
            <p className="mt-1 text-xs text-muted-foreground">Keine aktiven Alarme</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {alerts.map((alert, i) => {
              const cfg = getSeverityConfig(alert.severity);
              return (
                <motion.div key={alert.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className={`border-l-2 px-5 py-4 hover:bg-surface-1/50 transition-colors ${cfg.border}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground leading-snug">{alert.message ?? "Alarm"}</p>
                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{alert.siteName}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[10px] text-muted-foreground mono">
                          {new Date(alert.createdAt).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
