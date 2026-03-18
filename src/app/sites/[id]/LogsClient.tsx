"use client";

import Link from "next/link";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, RefreshCw, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "@/components/dashboard/Header";
import SiteTabNav from "./SiteTabNav";
import type { LogsData } from "./page";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(ts: string) {
  return new Date(ts).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LogsClient({ data }: { data: LogsData }) {
  const { site, devices, telemetry, alertCount } = data;
  const router = useRouter();

  const siteName = site?.name ?? "Unbekannter Standort";
  const siteId = site?.id ?? "";

  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.hardware_id]));

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
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{siteName}</h1>
                <p className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  Telemetrie-Protokoll
                </p>
              </div>
            </div>
          </motion.div>

          {/* Tab navigation */}
          <Suspense fallback={null}>
            <SiteTabNav siteId={siteId} />
          </Suspense>

          {/* Logs panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Telemetrie-Protokoll
                </h3>
                <span className="text-[10px] text-muted-foreground mono">
                  {telemetry.length} Einträge
                </span>
              </div>
              <button
                onClick={() => router.refresh()}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Aktualisieren
              </button>
            </div>

            {telemetry.length === 0 ? (
              <div className="p-10 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-semibold text-foreground">Keine Telemetrie-Daten</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                  Starten Sie das Pi-Script, um Messdaten zu senden. Die Daten erscheinen hier in Echtzeit.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Zeitstempel
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Gerät
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Metrik
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Wert
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Einheit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {telemetry.map((t, i) => (
                      <tr key={i} className="hover:bg-surface-1/40 transition-colors">
                        <td className="px-5 py-3 mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(t.timestamp)}
                        </td>
                        <td className="px-5 py-3 mono text-xs text-foreground whitespace-nowrap">
                          {deviceMap[t.device_id] ?? t.device_id}
                        </td>
                        <td className="px-5 py-3 mono text-xs text-foreground">
                          {t.metric_type}
                        </td>
                        <td className="px-5 py-3 mono text-xs text-right font-semibold text-foreground">
                          {t.value.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {t.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
