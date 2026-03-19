"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CommandState = { error?: string; success?: boolean; message?: string } | null;

// Befehl an Pi senden via MQTT (publish über Supabase Edge Function)
// Der Pi abonniert ems/{hardware_id}/command
export async function sendDeviceCommandAction(
  prevState: CommandState,
  formData: FormData
): Promise<CommandState> {
  const supabase = await createClient();

  const hardware_id = formData.get("hardware_id") as string;
  const action      = formData.get("action") as string;
  const site_id     = formData.get("site_id") as string;
  const payload: Record<string, unknown> = { action };

  // Optionale Parameter
  const asset_id  = formData.get("asset_id") as string | null;
  const current_a = formData.get("current_a") as string | null;
  if (asset_id)  payload.asset_id  = asset_id;
  if (current_a) payload.current_a = parseFloat(current_a);

  if (!hardware_id || !action) return { error: "hardware_id und action erforderlich" };

  // MQTT Command via Supabase Edge Function publishen
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const topic        = `ems/${hardware_id}/command`;

  const resp = await fetch(`${supabaseUrl}/functions/v1/mqtt-publish`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ topic, payload }),
  });

  if (!resp.ok) {
    // Fallback: Command direkt in device_logs schreiben (Pi pollt dort nicht,
    // aber als Audit-Trail sinnvoll)
    console.error("mqtt-publish failed:", await resp.text());

    // Stattdessen: command in Supabase DB als pending command speichern
    // (Pi-Script könnte pending_commands Tabelle pollen — für späteren Ausbau)
    return {
      error: "MQTT-Publish nicht verfügbar. Bitte mqtt-publish Edge Function deployen.",
    };
  }

  if (site_id) revalidatePath(`/sites/${site_id}`);
  return { success: true, message: `Befehl "${action}" gesendet` };
}

// Site Config aktualisieren
export type SiteConfigState = { error?: string; success?: boolean } | null;

export async function updateSiteConfigAction(
  prevState: SiteConfigState,
  formData: FormData
): Promise<SiteConfigState> {
  const supabase = await createClient();

  const site_id              = formData.get("site_id") as string;
  const grid_limit_kw        = parseFloat(formData.get("grid_limit_kw") as string);
  const feed_in_limit_kw     = parseFloat(formData.get("feed_in_limit_kw") as string);
  const pv_optimization      = formData.get("pv_optimization") === "true";
  const battery_optimization = formData.get("battery_optimization") === "true";

  if (!site_id || isNaN(grid_limit_kw)) {
    return { error: "Ungültige Eingabe" };
  }

  const { error } = await supabase.from("site_configs").upsert({
    site_id,
    grid_limit_kw,
    feed_in_limit_kw: isNaN(feed_in_limit_kw) ? null : feed_in_limit_kw,
    pv_optimization,
    battery_optimization,
  }, { onConflict: "site_id" });

  if (error) return { error: error.message };

  revalidatePath(`/sites/${site_id}`);
  return { success: true };
}

// Site grid_connection_power_kw aktualisieren
export async function updateSiteGridPowerAction(
  prevState: SiteConfigState,
  formData: FormData
): Promise<SiteConfigState> {
  const supabase = await createClient();

  const site_id                   = formData.get("site_id") as string;
  const grid_connection_power_kw  = parseFloat(formData.get("grid_connection_power_kw") as string);
  const name                      = formData.get("name") as string | null;
  const address                   = formData.get("address") as string | null;

  if (!site_id || isNaN(grid_connection_power_kw)) {
    return { error: "Ungültige Eingabe" };
  }

  const update: Record<string, unknown> = { grid_connection_power_kw };
  if (name)    update.name    = name;
  if (address) update.address = address;

  const { error } = await supabase.from("sites").update(update).eq("id", site_id);

  if (error) return { error: error.message };

  revalidatePath(`/sites/${site_id}`);
  return { success: true };
}
