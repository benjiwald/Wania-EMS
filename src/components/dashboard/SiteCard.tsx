"use client";
import { motion } from "framer-motion";
import { MapPin, Zap, Sun, Battery, Car, ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import Link from "next/link";

export interface SiteData {
  id: string;
  name: string;
  address: string | null;
  status: string;
  lastSeen: string | null;
  alertCount: number;
  gridPower: number | null;
  pvPower: number | null;
  batterySoc: number | null;
  wallboxActive: number;
  wallboxTotal: number;
}

function getStatusColor(status: string) {
  if (status === "online")  return "var(--status-online)";
  if (status === "offline") return "var(--status-offline)";
  return "var(--status-warning)";
}

function getDotClass(status: string) {
  if (status === "online")  return "bg-status-online glow-dot animate-pulse-glow";
  if (status === "offline") return "bg-status-offline";
  return "bg-status-warning";
}

function formatTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SiteCard({ site, index = 0 }: { site: SiteData; index?: number }) {
  const totalPower = (site.gridPower ?? 0) + (site.pvPower ?? 0);
  const pvPercent  = totalPower > 0 && site.pvPower ? Math.round((site.pvPower / totalPower) * 100) : 0;
  const statusColor = getStatusColor(site.status);

  return (
    <Link href={`/sites/${site.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="group relative cursor-pointer glass-panel rounded-2xl card-hover overflow-hidden"
      >
        {/* Top accent glow line */}
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)` }} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full shrink-0 ${getDotClass(site.status)}`} />
              <div>
                <h3 className="font-bold text-foreground text-[15px] leading-tight">{site.name}</h3>
                <p className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{site.address ?? "—"}</span>
                </p>
              </div>
            </div>
            {site.alertCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-warning/15 px-1.5 text-[10px] font-bold text-status-warning border border-status-warning/20">
                {site.alertCount}
              </span>
            )}
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-2">
            <MetricItem icon={<Zap className="h-3.5 w-3.5" />} label="Netz"
              value={site.gridPower !== null ? site.gridPower.toFixed(1) : "—"} unit="kW"
              iconColor="text-status-info" bgColor="bg-status-info/10 border-status-info/10" />
            <MetricItem icon={<Sun className="h-3.5 w-3.5" />} label="PV"
              value={site.pvPower !== null ? site.pvPower.toFixed(1) : "—"} unit="kW"
              iconColor="text-status-warning" bgColor="bg-status-warning/10 border-status-warning/10" />
            <MetricItem icon={<Battery className="h-3.5 w-3.5" />} label="Speicher"
              value={site.batterySoc !== null ? site.batterySoc.toFixed(0) : "—"} unit="%"
              iconColor="text-status-online" bgColor="bg-status-online/10 border-status-online/10" />
            <MetricItem icon={<Car className="h-3.5 w-3.5" />} label="Wallboxen"
              value={site.wallboxTotal > 0 ? `${site.wallboxActive}/${site.wallboxTotal}` : "—"} unit=""
              iconColor="text-purple-400" bgColor="bg-purple-500/10 border-purple-500/10" />
          </div>

          {/* Energy bar */}
          {totalPower > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-warning" /> PV {pvPercent}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-info" /> Netz {100 - pvPercent}%
                </span>
              </div>
              <div className="flex h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="bg-status-warning rounded-l-full transition-all duration-500" style={{ width: `${pvPercent}%` }} />
                <div className="bg-status-info rounded-r-full transition-all duration-500"   style={{ width: `${100 - pvPercent}%` }} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-[10px] font-medium text-muted-foreground mono">{formatTime(site.lastSeen)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function MetricItem({ icon, label, value, unit, iconColor, bgColor }: {
  icon: ReactNode; label: string; value: string; unit: string; iconColor: string; bgColor: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${bgColor}`}>
      <div className={iconColor}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-foreground mono">
          {value}{unit && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
