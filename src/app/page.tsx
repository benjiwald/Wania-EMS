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
  ChevronRight,
  LogOut,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeviceStatus = "pending" | "online" | "offline" | "error";
type SiteStatus = "provisioning" | "active" | "inactive" | "error";
type AlertSeverity = "info" | "warning" | "critical";

interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  status: SiteStatus;
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
      .limit(10),
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
    supabase
      .from("assets")
      .select("site_id, status")
      .eq("asset_type", "wallbox"),
  ]);

  const telemetry: TelemetryRow[] = (telemetryRes.data ?? []) as TelemetryRow[];
  const wallboxes: WallboxRow[] = (wallboxRes.data ?? []) as WallboxRow[];

  // Latest metric per device
  const metricMap = new Map<string, Map<string, number>>();
  for (const row of telemetry) {
    if (!metricMap.has(row.device_id)) metricMap.set(row.device_id, new Map());
    const m = metricMap.get(row.device_id)!;
    if (!m.has(row.metric_type)) m.set(row.metric_type, row.value);
  }

  // Wallbox count per site
  const wallboxMap = new Map<string, { total: number; active: number }>();
  for (const wb of wallboxes) {
    const cur = wallboxMap.get(wb.site_id) ?? { total: 0, active: 0 };
    cur.total++;
    if (wb.status === "active") cur.active++;
    wallboxMap.set(wb.site_id, cur);
  }

  // Alert count per site
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

function fmt(value: number | null, unit: string) {
  if (value === null) return "—";
  return `${value} ${unit}`;
}

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} T.`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function DeviceBadge({ status }: { status: DeviceStatus }) {
  if (status === "online")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Online
      </span>
    );
  if (status === "offline")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-red-500">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Offline
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
      Ausstehend
    </span>
  );
}

function MetricPill({
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
    <div className="flex items-center gap-2.5">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${color}`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 leading-none">
          {label}
        </p>
        <p className="text-sm font-semibold text-zinc-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function SiteCard({
  site,
}: {
  site: Awaited<ReturnType<typeof getDashboardData>>["siteViews"][0];
}) {
  const isOffline = site.deviceStatus === "offline";
  const hasError = site.status === "error" || isOffline;

  return (
    <div className="group relative bg-white border border-zinc-100 rounded-xl overflow-hidden hover:border-zinc-200 hover:shadow-sm transition-all duration-150 cursor-pointer">
      {/* Wania accent line */}
      <div
        className="absolute top-0 left-0 w-[3px] h-full"
        style={{ backgroundColor: hasError ? "#ef4444" : "#C8D400" }}
      />

      <div className="pl-5 pr-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <DeviceBadge status={site.deviceStatus} />
              {site.alertCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {site.alertCount} {site.alertCount === 1 ? "Alarm" : "Alarme"}
                </span>
              )}
            </div>
            <p className="text-[15px] font-bold text-zinc-900 leading-snug truncate">
              {site.name}
            </p>
            {site.address && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-zinc-300 flex-shrink-0" />
                <span className="text-xs text-zinc-400 truncate">{site.address}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-200 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0" />
        </div>
      </div>

      <div className="mx-5 h-px bg-zinc-50" />

      <div className="pl-5 pr-4 py-4">
        {isOffline ? (
          <div className="flex items-center gap-2 text-zinc-400">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm">Keine Verbindung zur Steuerbox</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <MetricPill icon={Zap} label="Netz" value={fmt(site.gridPowerKw, "kW")} color="bg-blue-500" />
            <MetricPill icon={Sun} label="PV" value={fmt(site.pvPowerKw, "kW")} color="bg-amber-400" />
            <MetricPill icon={Battery} label="Speicher" value={fmt(site.batterySoc, "%")} color="bg-emerald-500" />
            <MetricPill
              icon={Car}
              label="Wallboxen"
              value={site.wallboxesTotal > 0 ? `${site.wallboxesActive} / ${site.wallboxesTotal}` : "—"}
              color="bg-violet-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: AlertRow }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          alert.severity === "critical" ? "bg-red-50" : "bg-amber-50"
        }`}
      >
        <AlertTriangle
          className={`h-3.5 w-3.5 ${
            alert.severity === "critical" ? "text-red-500" : "text-amber-500"
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 leading-snug">{alert.message}</p>
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
  const activeAlerts = alerts.length;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-100">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-5 w-[3px] rounded-full" style={{ backgroundColor: "#C8D400" }} />
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black tracking-[0.2em] uppercase text-zinc-900">
                WANIA
              </span>
              <span className="text-xs text-zinc-400 tracking-wide">
                EMS · Ladeparksteuerung
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400">
              {onlineCount} / {siteViews.length} online
            </span>
            {activeAlerts > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {activeAlerts}
              </span>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "STANDORTE", value: siteViews.length, icon: MapPin, cls: "text-zinc-500 bg-zinc-50" },
            { label: "ONLINE", value: onlineCount, icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50" },
            { label: "ALARME", value: activeAlerts, icon: AlertTriangle, cls: activeAlerts > 0 ? "text-red-500 bg-red-50" : "text-zinc-400 bg-zinc-50" },
          ].map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="bg-white border border-zinc-100 rounded-xl p-5 flex items-center gap-4">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${cls.split(" ")[1]}`}>
                <Icon className={`h-[1.1rem] w-[1.1rem] ${cls.split(" ")[0]}`} />
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900">{value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Sites list */}
          <div className="col-span-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
              Standorte
            </h2>
            {siteViews.length === 0 ? (
              <div className="bg-white border border-zinc-100 rounded-xl p-8 text-center text-sm text-zinc-400">
                Keine Standorte vorhanden.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {siteViews.map((site) => (
                  <SiteCard key={site.id} site={site} />
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
              Aktive Alarme
            </h2>
            <div className="bg-white border border-zinc-100 rounded-xl">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  <p className="text-sm text-zinc-400">Keine aktiven Alarme</p>
                </div>
              ) : (
                <div className="px-4 divide-y divide-zinc-50">
                  {alerts.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
