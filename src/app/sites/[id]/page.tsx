import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import SiteDetailClient from "./SiteDetailClient";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface DeviceRow {
  id: string;
  hardware_id: string;   // devices table has hardware_id, not name
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

// ─── Data fetching ───────────────────────────────────────────────────────────
async function getSiteDetailData(id: string): Promise<SiteDetailData | null> {
  const supabase = await createClient();

  // Fetch site with all its devices (devices has hardware_id, not name)
  const { data: siteRow, error: siteErr } = await supabase
    .from("sites")
    .select("id, name, address, status, devices(id, hardware_id, device_type, status, last_seen_at)")
    .eq("id", id)
    .single();

  if (siteErr || !siteRow) return null;

  const devices = (siteRow.devices ?? []) as DeviceRow[];
  const deviceIds = devices.map((d) => d.id);
  const firstDevice = devices[0] ?? null;

  // Parallel fetches
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

  const telemetry = (telemetryRes.data ?? []) as { device_id: string; metric_type: string; value: number; timestamp: string }[];

  // Build latest value per metric_type
  const latestMetrics: Record<string, number> = {};
  for (const t of telemetry) {
    if (!(t.metric_type in latestMetrics)) latestMetrics[t.metric_type] = t.value;
  }

  // Build time series — last 24 entries per metric, reversed to chronological
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

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSiteDetailData(id);

  if (!data) notFound();

  return <SiteDetailClient data={data} />;
}
