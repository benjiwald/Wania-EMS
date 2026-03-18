import { createClient } from "@/lib/supabase/server";
import { Building2, Sun, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import Header from "@/components/dashboard/Header";
import KPICard from "@/components/dashboard/KPICard";
import SiteCard, { SiteData } from "@/components/dashboard/SiteCard";
import AlertsPanel, { AlertData } from "@/components/dashboard/AlertsPanel";
import SystemStatus from "@/components/dashboard/SystemStatus";

// ─── Types ────────────────────────────────────────────────────────────────────
type DeviceStatus = "pending" | "online" | "offline" | "error";
type AlertSeverity = "info" | "warning" | "critical";

interface SiteRow {
  id: string; name: string; address: string | null; status: string;
  devices: { id: string; status: DeviceStatus; last_seen_at: string | null }[];
}
interface TelemetryRow { device_id: string; metric_type: string; value: number; }
interface AlertRow {
  id: string; site_id: string; message: string; severity: AlertSeverity;
  created_at: string; sites: { name: string } | null;
}

// ─── Data fetching ─────────────────────────────────────────────────────────────
async function getDashboardData() {
  const supabase = await createClient();

  const [sitesRes, alertsRes] = await Promise.all([
    supabase.from("sites").select("id, name, address, status, devices(id, status, last_seen_at)").order("name"),
    supabase.from("alerts").select("id, site_id, message, severity, created_at, sites(name)")
      .is("resolved_at", null).order("created_at", { ascending: false }).limit(20),
  ]);

  const sites: SiteRow[]  = (sitesRes.data  ?? []) as SiteRow[];
  const alerts: AlertRow[] = (alertsRes.data ?? []) as unknown as AlertRow[];
  const deviceIds = sites.flatMap((s) => s.devices.map((d) => d.id));

  const [telemetryRes, wallboxRes] = await Promise.all([
    deviceIds.length
      ? supabase.from("telemetry").select("device_id, metric_type, value")
          .in("device_id", deviceIds).order("timestamp", { ascending: false }).limit(deviceIds.length * 10)
      : Promise.resolve({ data: [] }),
    supabase.from("assets").select("site_id, status").eq("asset_type", "wallbox"),
  ]);

  const telemetry: TelemetryRow[] = (telemetryRes.data ?? []) as TelemetryRow[];
  const wallboxes = (wallboxRes.data ?? []) as { site_id: string; status: string }[];

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
  for (const a of alerts) alertCountMap.set(a.site_id, (alertCountMap.get(a.site_id) ?? 0) + 1);

  const siteCards: SiteData[] = sites.map((site) => {
    const device  = site.devices[0] ?? null;
    const metrics = device ? metricMap.get(device.id) : null;
    const wb      = wallboxMap.get(site.id) ?? { total: 0, active: 0 };
    return {
      id: site.id, name: site.name, address: site.address,
      status: device?.status ?? "pending",
      lastSeen: device?.last_seen_at ?? null,
      gridPower:    metrics?.get("grid_power")    ?? null,
      pvPower:      metrics?.get("pv_power")      ?? null,
      batterySoc:   metrics?.get("battery_soc")   ?? null,
      wallboxActive: wb.active, wallboxTotal: wb.total,
      alertCount: alertCountMap.get(site.id) ?? 0,
    };
  });

  const alertCards: AlertData[] = alerts.map((a) => ({
    id: a.id, siteName: a.sites?.name ?? "—",
    severity: a.severity, message: a.message, createdAt: a.created_at,
  }));

  return { siteCards, alertCards };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { siteCards, alertCards } = await getDashboardData();

  const onlineSites   = siteCards.filter((s) => s.status === "online").length;
  const totalPvKw     = siteCards.reduce((sum, s) => sum + (s.pvPower   ?? 0), 0);
  const totalGridKw   = siteCards.reduce((sum, s) => sum + (s.gridPower ?? 0), 0);
  const totalAlerts   = alertCards.length;

  const allDevices    = siteCards.length;
  const onlineDevices = siteCards.filter((s) => s.status === "online").length;
  const offlineDevices= siteCards.filter((s) => s.status === "offline").length;
  const pendingDevices= siteCards.filter((s) => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/[0.02] blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-status-info/[0.015] blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Header alertCount={totalAlerts} userEmail={user?.email} />

        <main className="mx-auto max-w-[1440px] px-6 py-8">
          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Übersicht aller Ladeparks und Systeme</p>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
            <KPICard index={0} label="Standorte" value={siteCards.length} subtitle={`${onlineSites} online`}
              icon={<Building2 className="h-5 w-5 text-primary" />} />
            <KPICard index={1} label="PV Leistung" value={totalPvKw.toFixed(1)} subtitle="kW"
              icon={<Sun className="h-5 w-5 text-status-warning" />} />
            <KPICard index={2} label="Netzbezug" value={totalGridKw.toFixed(1)} subtitle="kW"
              icon={<Zap className="h-5 w-5 text-status-info" />} />
            <KPICard index={3} label="Alarme" value={totalAlerts} subtitle={totalAlerts > 0 ? "aktiv" : "keine"}
              icon={totalAlerts > 0
                ? <AlertTriangle className="h-5 w-5 text-status-offline" />
                : <CheckCircle2  className="h-5 w-5 text-status-online" />} />
          </div>

          {/* Main content */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Site cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Standorte</h2>
                <span className="text-[11px] font-medium text-muted-foreground mono">{siteCards.length} gesamt</span>
              </div>
              {siteCards.length === 0 ? (
                <div className="glass-panel rounded-2xl p-16 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-4 text-sm font-semibold text-foreground">Keine Standorte</p>
                  <p className="mt-1 text-xs text-muted-foreground">Standorte werden hier angezeigt</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {siteCards.map((site, i) => <SiteCard key={site.id} site={site} index={i} />)}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <AlertsPanel alerts={alertCards} />
              <SystemStatus
                onlineCount={onlineDevices} offlineCount={offlineDevices}
                pendingCount={pendingDevices} totalDevices={allDevices} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
