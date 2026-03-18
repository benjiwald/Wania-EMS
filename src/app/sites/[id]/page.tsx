import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SiteDetailClient from "./SiteDetailClient";
import CommissioningClient from "./CommissioningClient";
import LogsClient from "./LogsClient";

// ─── Types: Overview ─────────────────────────────────────────────────────────
export interface DeviceRow {
  id: string;
  hardware_id: string;
  device_type: string;
  status: string;
  last_seen_at: string | null;
}

export interface AlertRow {
  id: string;
  message: string;
  severity: string;
  created_at: string;
}

export interface AssetRow {
  id: string;
  name: string | null;
  status: string;
  asset_type: string;
}

export interface SiteConfig {
  grid_limit_kw: number | null;
  feed_in_limit_kw: number | null;
  pv_optimization: boolean;
  battery_optimization: boolean;
}

export interface SiteDetailData {
  site: { id: string; name: string; address: string | null; status: string; last_seen_at: string | null };
  devices: DeviceRow[];
  alerts: AlertRow[];
  assets: AssetRow[];
  config: SiteConfig | null;
  latestMetrics: Record<string, number>;
  timeSeriesMap: Record<string, { time: string; value: number }[]>;
}

// ─── Types: Setup ─────────────────────────────────────────────────────────────
export interface DeviceFullRow {
  id: string;
  hardware_id: string;
  device_type: string;
  status: string;
  last_seen_at: string | null;
  software_version: string | null;
  config: Record<string, unknown>;
}

export interface AssetFullRow {
  id: string;
  name: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  connection_type: string;
  connection_params: { host?: string; port?: number; unit_id?: number };
  is_controllable: boolean;
  status: string;
}

export interface TemplateRow {
  id: string;
  manufacturer: string;
  model: string;
  asset_type: string;
  default_port: number;
  default_unit_id: number | null;
  register_map: Record<string, unknown>;
  description: string | null;
}

export interface SetupData {
  site: { id: string; name: string; address: string | null; status: string } | null;
  devices: DeviceFullRow[];
  assets: AssetFullRow[];
  templates: TemplateRow[];
  alertCount: number;
}

// ─── Types: Logs ─────────────────────────────────────────────────────────────
export interface TelemetryLogRow {
  device_id: string;
  metric_type: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface LogsData {
  site: { id: string; name: string } | null;
  devices: { id: string; hardware_id: string }[];
  telemetry: TelemetryLogRow[];
  alertCount: number;
}

// ─── Data fetching: Overview ──────────────────────────────────────────────────
async function getSiteDetailData(id: string): Promise<SiteDetailData | null> {
  const supabase = await createClient();

  const { data: siteRow, error: siteErr } = await supabase
    .from("sites")
    .select("id, name, address, status, devices(id, hardware_id, device_type, status, last_seen_at)")
    .eq("id", id)
    .single();

  if (siteErr || !siteRow) return null;

  const devices = (siteRow.devices ?? []) as DeviceRow[];
  const deviceIds = devices.map((d) => d.id);
  const firstDevice = devices[0] ?? null;

  const [alertsRes, telemetryRes, assetsRes, configRes] = await Promise.all([
    supabase
      .from("alerts")
      .select("id, message, severity, created_at")
      .eq("site_id", id)
      .is("resolved_at", null)
      .order("created_at", { ascending: false }),
    deviceIds.length
      ? supabase
          .from("telemetry")
          .select("device_id, metric_type, value, timestamp")
          .in("device_id", deviceIds)
          .order("timestamp", { ascending: false })
          .limit(deviceIds.length * 24 * 5)
      : Promise.resolve({ data: [] }),
    supabase
      .from("assets")
      .select("id, name, status, asset_type")
      .eq("site_id", id)
      .eq("asset_type", "wallbox"),
    supabase
      .from("site_configs")
      .select("grid_limit_kw, feed_in_limit_kw, pv_optimization, battery_optimization")
      .eq("site_id", id)
      .maybeSingle(),
  ]);

  const telemetry = (telemetryRes.data ?? []) as {
    device_id: string; metric_type: string; value: number; timestamp: string;
  }[];

  const latestMetrics: Record<string, number> = {};
  for (const t of telemetry) {
    if (!(t.metric_type in latestMetrics)) latestMetrics[t.metric_type] = t.value;
  }

  const timeSeriesMap: Record<string, { time: string; value: number }[]> = {};
  for (const t of telemetry) {
    if (!timeSeriesMap[t.metric_type]) timeSeriesMap[t.metric_type] = [];
    if (timeSeriesMap[t.metric_type].length < 24) {
      timeSeriesMap[t.metric_type].push({
        time: new Date(t.timestamp).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }),
        value: t.value,
      });
    }
  }
  for (const key in timeSeriesMap) timeSeriesMap[key].reverse();

  return {
    site: {
      id: siteRow.id,
      name: siteRow.name,
      address: siteRow.address,
      status: firstDevice?.status ?? siteRow.status ?? "pending",
      last_seen_at: firstDevice?.last_seen_at ?? null,
    },
    devices,
    alerts: (alertsRes.data ?? []) as AlertRow[],
    assets: (assetsRes.data ?? []) as AssetRow[],
    config: (configRes.data as SiteConfig | null) ?? null,
    latestMetrics,
    timeSeriesMap,
  };
}

// ─── Data fetching: Setup ─────────────────────────────────────────────────────
async function getSetupData(id: string): Promise<SetupData | null> {
  const supabase = await createClient();

  const [siteRes, devicesRes, assetsRes, templatesRes, alertCountRes] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, address, status")
      .eq("id", id)
      .single(),
    supabase
      .from("devices")
      .select("id, hardware_id, device_type, status, last_seen_at, software_version, config")
      .eq("site_id", id),
    supabase
      .from("assets")
      .select("id, name, asset_type, manufacturer, model, connection_type, connection_params, is_controllable, status")
      .eq("site_id", id),
    supabase
      .from("device_templates")
      .select("id, manufacturer, model, asset_type, default_port, default_unit_id, register_map, description")
      .order("manufacturer"),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .is("resolved_at", null),
  ]);

  if (siteRes.error && !siteRes.data) return null;

  return {
    site: siteRes.data
      ? {
          id: siteRes.data.id,
          name: siteRes.data.name,
          address: siteRes.data.address,
          status: siteRes.data.status,
        }
      : null,
    devices: (devicesRes.data ?? []) as DeviceFullRow[],
    assets: (assetsRes.data ?? []) as AssetFullRow[],
    templates: (templatesRes.data ?? []) as TemplateRow[],
    alertCount: alertCountRes.count ?? 0,
  };
}

// ─── Data fetching: Logs ──────────────────────────────────────────────────────
async function getLogsData(id: string): Promise<LogsData | null> {
  const supabase = await createClient();

  const [siteRes, devicesRes, alertCountRes] = await Promise.all([
    supabase.from("sites").select("id, name").eq("id", id).single(),
    supabase.from("devices").select("id, hardware_id").eq("site_id", id),
    supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .is("resolved_at", null),
  ]);

  if (siteRes.error && !siteRes.data) return null;

  const devices = (devicesRes.data ?? []) as { id: string; hardware_id: string }[];
  const deviceIds = devices.map((d) => d.id);

  const telemetryRes = deviceIds.length
    ? await supabase
        .from("telemetry")
        .select("device_id, metric_type, value, unit, timestamp")
        .in("device_id", deviceIds)
        .order("timestamp", { ascending: false })
        .limit(200)
    : { data: [] };

  return {
    site: siteRes.data ? { id: siteRes.data.id, name: siteRes.data.name } : null,
    devices,
    telemetry: (telemetryRes.data ?? []) as TelemetryLogRow[],
    alertCount: alertCountRes.count ?? 0,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab = "overview" }] = await Promise.all([params, searchParams]);

  if (tab === "setup") {
    const data = await getSetupData(id);
    if (!data) notFound();
    return <CommissioningClient data={data} />;
  }

  if (tab === "logs") {
    const data = await getLogsData(id);
    if (!data) notFound();
    return <LogsClient data={data} />;
  }

  // Default: overview
  const data = await getSiteDetailData(id);
  if (!data) notFound();
  return <SiteDetailClient data={data} />;
}
