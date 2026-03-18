"use client";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Clock } from "lucide-react";

export default function SystemStatus({ onlineCount, offlineCount, pendingCount, totalDevices }: {
  onlineCount: number; offlineCount: number; pendingCount: number; totalDevices: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      <div className="border-b border-border/50 px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Systemstatus</h2>
      </div>
      <div className="p-5 space-y-4">
        <StatusRow icon={<Wifi className="h-4 w-4 text-status-online" />} label="Online"
          count={onlineCount} total={totalDevices} barColor="bg-status-online" bgColor="bg-status-online/10" delay={0.5} />
        <StatusRow icon={<WifiOff className="h-4 w-4 text-status-offline" />} label="Offline"
          count={offlineCount} total={totalDevices} barColor="bg-status-offline" bgColor="bg-status-offline/10" delay={0.55} />
        <StatusRow icon={<Clock className="h-4 w-4 text-status-warning" />} label="Ausstehend"
          count={pendingCount} total={totalDevices} barColor="bg-status-warning" bgColor="bg-status-warning/10" delay={0.6} />

        <div className="pt-3 border-t border-border/50 space-y-2">
          {[
            { label: "MQTT Broker", ok: true },
            { label: "Datenbank",   ok: true },
            { label: "Edge Functions", ok: true },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className={`flex items-center gap-1 font-medium ${ok ? "text-status-online" : "text-status-offline"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-status-online" : "bg-status-offline"}`} />
                {ok ? "Verbunden" : "Fehler"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatusRow({ icon, label, count, total, barColor, bgColor, delay }: {
  icon: React.ReactNode; label: string; count: number; total: number;
  barColor: string; bgColor: string; delay: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor} shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-xs font-bold text-foreground mono">{count}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
          <motion.div className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ delay, duration: 0.6, ease: "easeOut" }} />
        </div>
      </div>
    </div>
  );
}
