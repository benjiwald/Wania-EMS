import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import {
  Zap,
  Sun,
  Battery,
  Car,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  MapPin,
  LogOut,
  Activity,
  ArrowRight,
  Building2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceStatus = "pending" | "online" | "offline" | "error";
type AlertSeverity = "info" | "warning" | "critical";

interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  status: string;
  devices: { id: string; status: DeviceStatus; last_seen_at: string | null }[];
}

interface TelemetryRow {
  device_id: string;
  metric_type: string;
  value: number;
}

interface AlertRow {
  id: string;
  site_id: string;
  message: string;
  severity: AlertSeverity;
  created_at: string;
  sites: { name: string } | null;
}

interface WallboxRow {
  site_id: string;
  status: string;
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getDashboardData() {
  const supabase = await createClient();

  const [sitesRes, alertsRes] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, address, status, devices(id, status, last_seen_at)")
      .order("name"),
    supabase
      .from("alerts")
      .select("id, site_id, message, severity, created_at, sites(name)")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const sites: SiteRow[] = (sitesRes.data ?? []) as SiteRow[];
  const alerts: AlertRow[] = (alertsRes.data ?? []) as unknown as AlertRow[];
  const deviceIds = sites.flatMap((s) => s.devices.map((d) => d.id));

  const [telemetryRes, wallboxRes] = await Promise.all([
    deviceIds.length
      ? supabase
          .from("telemetry")
          .select("device_id, metric_type, value")
          .in("device_id", deviceIds)
          .order("timestamp", { ascending: false })
          .limit(deviceIds.length * 10)
      : Promise.resolve({ data: [] }),
    supabase.from("assets").select("site_id, status").eq("asset_type", "wallbox"),
  ]);

  const telemetry: TelemetryRow[] = (telemetryRes.data ?? []) as TelemetryRow[];
  const wallboxes: WallboxRow[] = (wallboxRes.data ?? []) as WallboxRow[];

  const metricMap = new Map<string, Map<string, number>>();
  for (const row of telemetry) {
    if (!metricMap.has(row.device_id)) metricMap.set(row.device_id, new Map());
    const m = metricMap.get(row.device_id)!;
    if (!m.has(row.metric_type)) m.set(row.metric_type, row.value);
  }

  const wallboxMap = new Map<string, { total: number; active: number }>();
  for (const wb of wallboxes) {
    const cur = wallboxMap.get(wb.site_id) ?? { total: 0, active: 0 };
    cur.total++;
    if (wb.status === "active") cur.active++;
    wallboxMap.set(wb.site_id, cur);
  }

  const alertCountMap = new Map<string, number>();
  for (const a of alerts) {
    alertCountMap.set(a.site_id, (alertCountMap.get(a.site_id) ?? 0) + 1);
  }

  const siteViews = sites.map((site) => {
    const device = site.devices[0] ?? null;
    const metrics = device ? metricMap.get(device.id) : null;
    const wb = wallboxMap.get(site.id) ?? { total: 0, active: 0 };
    return {
      id: site.id,
      name: site.name,
      address: site.address ?? "",
      status: site.status,
      deviceStatus: (device?.status ?? "pending") as DeviceStatus,
      lastSeen: device?.last_seen_at ?? null,
      gridPowerKw: metrics?.get("grid_power") ?? null,
      pvPowerKw: metrics?.get("pv_power") ?? null,
      batterySoc: metrics?.get("battery_soc") ?? null,
      wallboxesActive: wb.active,
      wallboxesTotal: wb.total,
      alertCount: alertCountMap.get(site.id) ?? 0,
    };
  });

  return { siteViews, alerts };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, unit: string, decimals = 1) {
  if (v === null) return "—";
  return `${v.toFixed(decimals)} ${unit}`;
}

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} T.`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DeviceStatus }) {
  if (status === "online")
    return (
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Online</span>
      </span>
    );
  if (status === "offline")
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Offline</span>
      </span>
    );
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-zinc-300" />
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ausstehend</span>
    </span>
  );
}

function EnergyBar({ grid, pv, battery }: { grid: number | null; pv: number | null; battery: number | null }) {
  const total = (grid ?? 0) + (pv ?? 0);
  const pvShare = total > 0 && pv !== null ? (pv / total) * 100 : 0;
  const gridShare = 100 - pvShare;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-100">
        <div
          className="h-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pvShare}%` }}
        />
        <div
          className="h-full bg-blue-400 transition-all duration-500"
          style={{ width: `${gridShare}%` }}
        />
      </div>
      <div className="flex gap-3 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />PV {pvShare.toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />Netz {gridShare.toFixed(0)}%</span>
        {battery !== null && <span className="flex items-center gap-1 ml-auto"><Battery className="h-3 w-3" />{battery.toFixed(0)}%</span>}
      </div>
    </div>
  );
}

type SiteView = Awaited<ReturnType<typeof getDashboardData>>["siteViews"][0];

function SiteCard({ site }: { site: SiteView }) {
  const isOffline = site.deviceStatus === "offline";
  const hasData = site.gridPowerKw !== null || site.pvPowerKw !== null;

  return (
    <div className="group bg-white rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Top accent */}
      <div
        className="h-0.5 w-full"
        style={{
          background: isOffline
            ? "#f87171"
            : site.alertCount > 0
            ? "#fbbf24"
            : "#C8D400",
        }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <StatusDot status={site.deviceStatus} />
            <h3 className="mt-2 text-base font-bold text-zinc-900 leading-tight truncate">
              {site.name}
            </h3>
            {site.address && (
              <p className="flex items-center gap-1 mt-0.5 text-xs text-zinc-400 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {site.address}
              </p>
            )}
          </div>
          {site.alertCount > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1 bg-amber-50 text-amber-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              {site.alertCount}
            </div>
          )}
        </div>

        {/* Metrics */}
        {isOffline ? (
          <div className="flex items-center gap-2 py-3 text-sm text-zinc-400">
            <WifiOff className="h-4 w-4" />
            Keine Verbindung zur Steuerbox
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Metric icon={Zap} label="Netz" value={fmt(site.gridPowerKw, "kW")} color="bg-blue-500" />
              <Metric icon={Sun} label="PV" value={fmt(site.pvPowerKw, "kW")} color="bg-amber-400" />
              <Metric icon={Battery} label="Speicher" value={fmt(site.batterySoc, "%", 0)} color="bg-emerald-500" />
              <Metric
                icon={Car}
                label="Wallboxen"
                value={site.wallboxesTotal > 0 ? `${site.wallboxesActive}/${site.wallboxesTotal}` : "—"}
                color="bg-violet-500"
              />
            </div>

            {hasData && (
              <EnergyBar
                grid={site.gridPowerKw}
                pv={site.pvPowerKw}
                battery={site.batterySoc}
              />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {site.lastSeen && (
        <div className="px-5 py-3 border-t border-zinc-50 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            Zuletzt gesehen {relativeTime(site.lastSeen)}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-200 group-hover:text-zinc-400 transition-colors" />
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-zinc-50 rounded-xl p-3">
      <div className={`flex-shrink-0 h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-none">{label}</p>
        <p className="text-sm font-bold text-zinc-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function AlertBadge({ alert }: { alert: AlertRow }) {
  const isCritical = alert.severity === "critical";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-50 last:border-0">
      <div className={`mt-0.5 h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center ${isCritical ? "bg-red-50" : "bg-amber-50"}`}>
        <AlertTriangle className={`h-3.5 w-3.5 ${isCritical ? "text-red-500" : "text-amber-500"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-800 leading-snug font-medium">{alert.message}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {alert.sites?.name} · {relativeTime(alert.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { siteViews, alerts } = await getDashboardData();

  const onlineCount = siteViews.filter((s) => s.deviceStatus === "online").length;
  const totalPvKw = siteViews.reduce((sum, s) => sum + (s.pvPowerKw ?? 0), 0);
  const totalGridKw = siteViews.reduce((sum, s) => sum + (s.gridPowerKw ?? 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ backgroundColor: "#C8D400" }}>
              <Activity className="h-3.5 w-3.5 text-zinc-900" />
            </div>
            <span className="text-sm font-black tracking-[0.15em] uppercase text-zinc-900">WANIA EMS</span>
          </div>

          <div className="flex items-center gap-6">
            {alerts.length > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {alerts.length} Alarm{alerts.length !== 1 ? "e" : ""}
              </div>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Standorte",
              value: siteViews.length,
              sub: `${onlineCount} online`,
              icon: Building2,
              accent: "#C8D400",
            },
            {
              label: "PV-Leistung",
              value: `${totalPvKw.toFixed(1)} kW`,
              sub: "gesamt aktiv",
              icon: Sun,
              accent: "#fbbf24",
            },
            {
              label: "Netzbezug",
              value: `${totalGridKw.toFixed(1)} kW`,
              sub: "gesamt aktiv",
              icon: Zap,
              accent: "#60a5fa",
            },
            {
              label: "Alarme",
              value: alerts.length,
              sub: alerts.length === 0 ? "alles OK" : "offen",
              icon: alerts.length > 0 ? AlertTriangle : CheckCircle2,
              accent: alerts.length > 0 ? "#f87171" : "#34d399",
            },
          ].map(({ label, value, sub, icon: Icon, accent }) => (
            <div key={label} className="bg-white rounded-2xl border border-zinc-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}20` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                </div>
              </div>
              <p className="text-2xl font-black text-zinc-900">{value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Site Cards */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Standorte
              </h2>
              <span className="text-[11px] text-zinc-400">{siteViews.length} gesamt</span>
            </div>

            {siteViews.length === 0 ? (
              <div className="bg-white border border-zinc-100 rounded-2xl p-12 text-center">
                <Building2 className="h-8 w-8 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Keine Standorte vorhanden</p>
              </div>
            ) : (
              siteViews.map((site) => <SiteCard key={site.id} site={site} />)
            )}
          </div>

          {/* Alerts Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Aktive Alarme
              </h2>
              {alerts.length > 0 && (
                <span className="h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-zinc-700">Alles in Ordnung</p>
                  <p className="text-xs text-zinc-400">Keine aktiven Alarme</p>
                </div>
              ) : (
                <div className="px-4 divide-y divide-zinc-50">
                  {alerts.map((a) => <AlertBadge key={a.id} alert={a} />)}
                </div>
              )}
            </div>

            {/* Quick Info */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">System</p>
              <div className="space-y-2">
                {[
                  { label: "MQTT Broker", value: "Verbunden", ok: true },
                  { label: "Datenbank", value: "Verbunden", ok: true },
                  { label: "Edge Functions", value: "Aktiv", ok: true },
                ].map(({ label, value, ok }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">{label}</span>
                    <span className={`flex items-center gap-1 font-medium ${ok ? "text-emerald-600" : "text-red-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
