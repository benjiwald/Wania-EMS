"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Zap, Sun, Battery, Car,
  Wifi, WifiOff, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Settings2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Header from "@/components/dashboard/Header";
import type { SiteDetailData } from "./page";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getStatusConfig(status: string) {
  if (status === "online")  return { label: "Online",     dotClass: "bg-status-online glow-dot animate-pulse-glow", textClass: "text-status-online" };
  if (status === "offline") return { label: "Offline",    dotClass: "bg-status-offline",                            textClass: "text-status-offline" };
  return                           { label: "Ausstehend", dotClass: "bg-status-warning",                            textClass: "text-status-warning" };
}

function getSeverityIcon(severity: string) {
  if (severity === "critical") return <AlertCircle  className="h-4 w-4 shrink-0 text-status-offline" />;
  if (severity === "warning")  return <AlertTriangle className="h-4 w-4 shrink-0 text-status-warning" />;
  return                              <Info          className="h-4 w-4 shrink-0 text-status-info" />;
}

function formatTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SiteDetailClient({ data }: { data: SiteDetailData }) {
  const { site, devices, alerts, assets, config, latestMetrics, timeSeriesMap } = data;

  const statusConfig   = getStatusConfig(site.status);
  const gridPower      = latestMetrics["grid_power"]   ?? 0;
  const pvPower        = latestMetrics["pv_power"]     ?? 0;
  const batterySoc     = latestMetrics["battery_soc"]  ?? 0;
  const wallboxActive  = assets.filter((a) => a.status === "active").length;
  const wallboxTotal   = assets.length;
  const totalPower     = gridPower + pvPower;
  const pvPercent      = totalPower > 0 ? Math.round((pvPower / totalPower) * 100) : 0;
  const onlineDevices  = devices.filter((d) => d.status === "online").length;
  const offlineDevices = devices.filter((d) => d.status === "offline").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/[0.02] blur-[150px]" />
      </div>

      <div className="relative z-10">
        <Header alertCount={alerts.length} />

        <main className="mx-auto max-w-[1440px] px-6 py-8">
          {/* Back + title */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 -ml-1 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zum Dashboard
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 mt-2">
              <div className="flex items-center gap-4">
                <span className={`h-3 w-3 rounded-full shrink-0 ${statusConfig.dotClass}`} />
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{site.name}</h1>
                  <p className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {site.address ?? "Keine Adresse"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${statusConfig.textClass}`}>{statusConfig.label}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground mono">Zuletzt: {formatTime(site.last_seen_at)}</span>
              </div>
            </div>
          </motion.div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
            <MetricCard index={0} icon={<Zap     className="h-5 w-5 text-status-info"    />} label="Netzbezug"  value={gridPower.toFixed(1)}    unit="kW"   />
            <MetricCard index={1} icon={<Sun     className="h-5 w-5 text-status-warning" />} label="PV Leistung" value={pvPower.toFixed(1)}       unit="kW"   />
            <MetricCard index={2} icon={<Battery className="h-5 w-5 text-status-online"  />} label="Speicher"   value={batterySoc.toFixed(0)}    unit="%"    />
            <MetricCard index={3} icon={<Car     className="h-5 w-5 text-primary"        />} label="Wallboxen"  value={`${wallboxActive}/${wallboxTotal}`} unit="aktiv" />
          </div>

          {/* Main grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2/3 */}
            <div className="lg:col-span-2 space-y-6">

              {/* Energy mix bar */}
              {totalPower > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="glass-panel rounded-2xl p-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Energiemix</h3>
                  <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning" /> PV {pvPercent}%</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-info" /> Netz {100 - pvPercent}%</span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="bg-status-warning rounded-l-full transition-all duration-700" style={{ width: `${pvPercent}%` }} />
                    <div className="bg-status-info rounded-r-full transition-all duration-700"    style={{ width: `${100 - pvPercent}%` }} />
                  </div>
                </motion.div>
              )}

              {/* Charts */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="glass-panel rounded-2xl p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Leistungsverlauf</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <ChartPanel title="Netzbezug (kW)"  data={timeSeriesMap["grid_power"]}  color="hsl(var(--status-info))" />
                  <ChartPanel title="PV Leistung (kW)" data={timeSeriesMap["pv_power"]}   color="hsl(var(--status-warning))" />
                  <ChartPanel title="Speicher (%)"     data={timeSeriesMap["battery_soc"]} color="hsl(var(--status-online))" />
                  <ChartPanel title="Wallbox aktiv"    data={timeSeriesMap["wallbox_active"]} color="hsl(var(--primary))" />
                </div>
              </motion.div>

              {/* Devices table */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="glass-panel rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Geräte</h3>
                  <span className="text-[11px] text-muted-foreground mono">{onlineDevices}/{devices.length} online</span>
                </div>
                {devices.length === 0 ? (
                  <div className="p-10 text-center">
                    <Settings2 className="mx-auto h-6 w-6 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">Keine Geräte konfiguriert</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {devices.map((d) => {
                      const ds = getStatusConfig(d.status);
                      return (
                        <div key={d.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-1/50">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${ds.dotClass}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{d.hardware_id}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{d.device_type}</p>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${ds.textClass}`}>{ds.label}</span>
                          <span className="text-[10px] text-muted-foreground mono">{formatTime(d.last_seen_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right 1/3 */}
            <div className="space-y-6">

              {/* Alerts */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="glass-panel rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Alarme</h3>
                  {alerts.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-[10px] font-bold text-destructive border border-destructive/20">
                      {alerts.length}
                    </span>
                  )}
                </div>
                {alerts.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-status-online/10 border border-status-online/20">
                      <CheckCircle2 className="h-5 w-5 text-status-online" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">Alles in Ordnung</p>
                    <p className="mt-1 text-xs text-muted-foreground">Keine aktiven Alarme</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto divide-y divide-border/30">
                    {alerts.map((a) => (
                      <div key={a.id} className="px-5 py-4 hover:bg-surface-1/50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          {getSeverityIcon(a.severity)}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{a.message}</p>
                            <p className="mt-2 text-[10px] text-muted-foreground mono">{formatTime(a.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Config */}
              {config && (config.grid_limit_kw != null || config.feed_in_limit_kw != null) && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="glass-panel rounded-2xl overflow-hidden">
                  <div className="border-b border-border/50 px-5 py-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Konfiguration</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {config.grid_limit_kw    != null && <ConfigRow label="Netzlimit"    value={`${config.grid_limit_kw} kW`} />}
                    {config.feed_in_limit_kw != null && <ConfigRow label="Einspeiselimit" value={`${config.feed_in_limit_kw} kW`} />}
                    <ConfigRow label="PV-Optimierung"      value={config.pv_optimization      ? "Aktiv" : "Inaktiv"} />
                    <ConfigRow label="Batterie-Optimierung" value={config.battery_optimization ? "Aktiv" : "Inaktiv"} />
                  </div>
                </motion.div>
              )}

              {/* Device status summary */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="glass-panel rounded-2xl overflow-hidden">
                <div className="border-b border-border/50 px-5 py-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gerätestatus</h3>
                </div>
                <div className="p-5 space-y-3">
                  <DeviceStatusRow
                    icon={<Wifi    className="h-4 w-4 text-status-online"  />} label="Online"
                    count={onlineDevices}  total={devices.length} barColor="bg-status-online"  bgColor="bg-status-online/10" />
                  <DeviceStatusRow
                    icon={<WifiOff className="h-4 w-4 text-status-offline" />} label="Offline"
                    count={offlineDevices} total={devices.length} barColor="bg-status-offline" bgColor="bg-status-offline/10" />
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ index, icon, label, value, unit }: {
  index: number; icon: React.ReactNode; label: string; value: string; unit: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="glass-panel rounded-2xl p-5 card-hover"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground mono">{value}</span>
            <span className="text-xs font-medium text-muted-foreground">{unit}</span>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 border border-border">{icon}</div>
      </div>
    </motion.div>
  );
}

function ChartPanel({ title, data, color }: {
  title: string; data?: { time: string; value: number }[]; color: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
        <div className="flex h-24 items-center justify-center">
          <p className="text-xs text-muted-foreground/50">Keine Daten</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              color: "hsl(var(--foreground))",
            }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${title.replace(/\s/g, "")})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground mono">{value}</span>
    </div>
  );
}

function DeviceStatusRow({ icon, label, count, total, barColor, bgColor }: {
  icon: React.ReactNode; label: string; count: number; total: number; barColor: string; bgColor: string;
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
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: 0.5, duration: 0.6 }}
          />
        </div>
      </div>
    </div>
  );
}
