"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useActionState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Server, Pencil, Trash2, Plus,
  Cpu, Zap, Battery, Car, Gauge, HelpCircle, RefreshCw,
} from "lucide-react";
import Header from "@/components/dashboard/Header";
import SiteTabNav from "./SiteTabNav";
import {
  addAssetAction,
  updateAssetAction,
  deleteAssetAction,
  type AssetActionState,
} from "@/app/actions/assets";
import type { SetupData, AssetFullRow, TemplateRow, DeviceRow } from "./page";
import { createClient } from "@/lib/supabase/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusConfig(status: string) {
  if (status === "online")  return { label: "Online",     dotClass: "bg-status-online glow-dot animate-pulse-glow", textClass: "text-status-online" };
  if (status === "offline") return { label: "Offline",    dotClass: "bg-status-offline",                            textClass: "text-status-offline" };
  return                           { label: "Ausstehend", dotClass: "bg-status-warning",                            textClass: "text-status-warning" };
}

function formatTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function hwModelLabel(deviceType: string): string {
  const map: Record<string, string> = {
    raspberry_pi_3b_plus: "Raspberry Pi 3 Model B+",
    raspberry_pi_4:       "Raspberry Pi 4",
    raspberry_pi_5:       "Raspberry Pi 5",
    n100_minipc:          "N100 Mini-PC",
    x86_minipc:           "x86 Mini-PC",
  };
  return map[deviceType] ?? deviceType.replace(/_/g, " ");
}

function assetTypeConfig(type: string) {
  switch (type) {
    case "wallbox":    return { label: "Wallbox",   color: "text-purple-400",          bg: "bg-purple-400/10",  icon: <Car   className="h-4 w-4" /> };
    case "inverter":   return { label: "Wechselrichter", color: "text-status-warning", bg: "bg-status-warning/10", icon: <Zap   className="h-4 w-4" /> };
    case "battery":    return { label: "Speicher",  color: "text-status-online",       bg: "bg-status-online/10",  icon: <Battery className="h-4 w-4" /> };
    case "meter":      return { label: "Zähler",    color: "text-status-info",         bg: "bg-status-info/10",    icon: <Gauge className="h-4 w-4" /> };
    case "heat_pump":  return { label: "Wärmepumpe", color: "text-orange-400",         bg: "bg-orange-400/10",  icon: <Cpu   className="h-4 w-4" /> };
    default:           return { label: "Sonstige",  color: "text-muted-foreground",    bg: "bg-surface-2",         icon: <HelpCircle className="h-4 w-4" /> };
  }
}

// ─── Input Style ──────────────────────────────────────────────────────────────
const inputClass =
  "w-full rounded-lg border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

// ─── Add Form ─────────────────────────────────────────────────────────────────
function AddAssetForm({
  siteId,
  templates,
  onCancel,
}: {
  siteId: string;
  templates: TemplateRow[];
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState<AssetActionState, FormData>(
    addAssetAction,
    null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (state?.success) {
      onCancel();
    }
  }, [state, onCancel]);

  return (
    <form action={formAction} className="space-y-4 mt-4 p-5 rounded-xl border border-border/50 bg-surface-1/50">
      <h4 className="text-sm font-semibold text-foreground">Neues Gerät</h4>

      {/* Template selector */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Vorlage</label>
        <select
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className={inputClass}
        >
          <option value="">Vorlage auswählen</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.manufacturer} {t.model} ({t.asset_type})
            </option>
          ))}
        </select>
      </div>

      {/* Hidden fields from template */}
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="asset_type" value={selectedTemplate?.asset_type ?? "other"} />
      <input type="hidden" name="manufacturer" value={selectedTemplate?.manufacturer ?? ""} />
      <input type="hidden" name="model" value={selectedTemplate?.model ?? ""} />
      <input type="hidden" name="register_map" value={selectedTemplate ? JSON.stringify(selectedTemplate.register_map) : "{}"} />
      <input type="hidden" name="is_controllable" value={selectedTemplate?.asset_type === "wallbox" ? "true" : "false"} />

      {/* Name */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Bezeichnung *</label>
        <input
          type="text"
          name="name"
          required
          placeholder={selectedTemplate ? `${selectedTemplate.manufacturer} ${selectedTemplate.model}` : "z.B. Fronius Wechselrichter"}
          className={inputClass}
        />
      </div>

      {/* Network params */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-xs text-muted-foreground mb-1.5">Host / IP *</label>
          <input
            type="text"
            name="host"
            required
            placeholder="192.168.1.xxx"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Port</label>
          <input
            type="number"
            name="port"
            defaultValue={selectedTemplate?.default_port ?? 502}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Unit ID</label>
          <input
            type="number"
            name="unit_id"
            defaultValue={selectedTemplate?.default_unit_id ?? 1}
            className={inputClass}
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-xs text-status-offline">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary/15 border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
        >
          {isPending ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────
function EditAssetForm({
  asset,
  siteId,
  onCancel,
}: {
  asset: AssetFullRow;
  siteId: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState<AssetActionState, FormData>(
    updateAssetAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      onCancel();
    }
  }, [state, onCancel]);

  return (
    <form action={formAction} className="space-y-4 p-4 rounded-xl border border-primary/20 bg-surface-1/50">
      <input type="hidden" name="asset_id" value={asset.id} />
      <input type="hidden" name="site_id" value={siteId} />

      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Bezeichnung *</label>
        <input type="text" name="name" required defaultValue={asset.name} className={inputClass} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-xs text-muted-foreground mb-1.5">Host / IP *</label>
          <input
            type="text"
            name="host"
            required
            defaultValue={asset.connection_params?.host ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Port</label>
          <input
            type="number"
            name="port"
            defaultValue={asset.connection_params?.port ?? 502}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Unit ID</label>
          <input
            type="number"
            name="unit_id"
            defaultValue={asset.connection_params?.unit_id ?? 1}
            className={inputClass}
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-xs text-status-offline">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary/15 border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
        >
          {isPending ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommissioningClient({ data }: { data: SetupData }) {
  const { site, devices: initialDevices, assets, templates, alertCount } = data;

  const [showAddForm, setShowAddForm]       = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [devices, setDevices]               = useState<DeviceRow[]>(initialDevices);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const siteId = site?.id ?? "";
  const siteName = site?.name ?? "Unbekannter Standort";
  const siteStatus = site?.status ?? "pending";
  const statusConfig = getStatusConfig(siteStatus);

  // ── Supabase Realtime: Device-Status live ─────────────────────────────────
  useEffect(() => {
    if (!siteId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`devices:site:${siteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `site_id=eq.${siteId}`,
        },
        (payload) => {
          setDevices((prev) => {
            if (payload.eventType === "INSERT") {
              return [...prev, payload.new as DeviceRow];
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((d) => d.id !== (payload.old as DeviceRow).id);
            }
            // UPDATE
            return prev.map((d) =>
              d.id === (payload.new as DeviceRow).id
                ? { ...d, ...(payload.new as DeviceRow) }
                : d
            );
          });
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [siteId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/[0.02] blur-[150px]" />
      </div>

      <div className="relative z-10">
        <Header alertCount={alertCount} />

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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 mt-2">
              <div className="flex items-center gap-4">
                <span className={`h-3 w-3 rounded-full shrink-0 ${statusConfig.dotClass}`} />
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{siteName}</h1>
                  <p className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {site?.address ?? "Keine Adresse"}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${statusConfig.textClass}`}>{statusConfig.label}</span>
            </div>
          </motion.div>

          {/* Tab navigation */}
          <Suspense fallback={null}>
            <SiteTabNav siteId={siteId} />
          </Suspense>

          {/* Content */}
          <div className="space-y-6">
            {/* Pi Status Panel */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-primary" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Steuerbox (Raspberry Pi)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <RefreshCw className={`h-3 w-3 ${realtimeConnected ? "text-status-online" : "text-muted-foreground/40"}`} />
                  {realtimeConnected ? "Live" : "Verbinde…"}
                </div>
              </div>

              {devices.length === 0 ? (
                <div className="p-10 text-center">
                  <Server className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm font-semibold text-foreground">Kein Pi registriert</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                    Verbinden Sie eine Steuerbox via MQTT. Die <span className="font-mono text-foreground/70">hardware_id</span> wird beim ersten Connect automatisch registriert.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {devices.map((device) => {
                    const ds = getStatusConfig(device.status);
                    const mqttBroker = (device.config?.mqtt_broker as string) ?? "—";
                    const mqttPort = (device.config?.mqtt_port as number | string) ?? "—";
                    return (
                      <div key={device.id} className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${ds.dotClass}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <p className="text-base font-bold mono text-foreground">{device.hardware_id}</p>
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/50">
                                {hwModelLabel(device.device_type)}
                              </span>
                              {(device.config?.venus_os_host as string) && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  → Venus OS
                                </span>
                              )}
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${ds.textClass}`}>
                                {ds.label}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4 text-xs">
                              <div>
                                <p className="text-muted-foreground mb-0.5">Hardware</p>
                                <p className="font-semibold text-foreground">{hwModelLabel(device.device_type)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-0.5">Letzter Kontakt</p>
                                <p className="font-semibold mono text-foreground">{formatTime(device.last_seen_at)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-0.5">Firmware</p>
                                <p className="font-semibold mono text-foreground">{device.software_version ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-0.5">MQTT-Broker</p>
                                <p className="font-semibold mono text-foreground">
                                  {mqttBroker !== "—" ? `${mqttBroker}:${mqttPort}` : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Assets Panel */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Modbus-Geräte
                </h3>
                <button
                  onClick={() => { setShowAddForm(true); setEditingId(null); setConfirmDeleteId(null); }}
                  className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Gerät hinzufügen
                </button>
              </div>

              <div className="p-5">
                {/* Add form */}
                {showAddForm && (
                  <AddAssetForm
                    siteId={siteId}
                    templates={templates}
                    onCancel={() => setShowAddForm(false)}
                  />
                )}

                {/* Asset list */}
                {assets.length === 0 && !showAddForm ? (
                  <div className="py-10 text-center">
                    <Cpu className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-3 text-sm font-semibold text-foreground">Keine Modbus-Geräte</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fügen Sie Wechselrichter, Batteriespeicher oder Wallboxen hinzu.
                    </p>
                  </div>
                ) : (
                  <div className={`${showAddForm ? "mt-4" : ""} space-y-3`}>
                    {assets.map((asset) => {
                      const tc = assetTypeConfig(asset.asset_type);
                      const cp = asset.connection_params ?? {};

                      if (editingId === asset.id) {
                        return (
                          <EditAssetForm
                            key={asset.id}
                            asset={asset}
                            siteId={siteId}
                            onCancel={() => setEditingId(null)}
                          />
                        );
                      }

                      return (
                        <div
                          key={asset.id}
                          className="flex items-start gap-4 rounded-xl border border-border/40 bg-surface-1/30 p-4 hover:bg-surface-1/60 transition-colors"
                        >
                          {/* Type badge */}
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tc.bg} ${tc.color} shrink-0`}>
                            {tc.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground">{asset.name}</p>
                            {(asset.manufacturer || asset.model) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[asset.manufacturer, asset.model].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            <p className="text-xs mono text-muted-foreground mt-1">
                              {cp.host ?? "—"}:{cp.port ?? 502} · Unit {cp.unit_id ?? 1}
                            </p>
                          </div>

                          {/* Type label */}
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${tc.bg} ${tc.color} border border-current/20 shrink-0`}>
                            {tc.label}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {confirmDeleteId === asset.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Wirklich löschen?</span>
                                <form action={deleteAssetAction}>
                                  <input type="hidden" name="asset_id" value={asset.id} />
                                  <input type="hidden" name="site_id" value={siteId} />
                                  <button
                                    type="submit"
                                    className="text-xs font-semibold text-status-offline hover:underline"
                                  >
                                    Ja
                                  </button>
                                </form>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                >
                                  Nein
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setEditingId(asset.id); setConfirmDeleteId(null); setShowAddForm(false); }}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                                  title="Bearbeiten"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(asset.id); setEditingId(null); }}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-status-offline hover:bg-status-offline/10 transition-colors"
                                  title="Löschen"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
