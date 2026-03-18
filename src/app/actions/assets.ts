'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AssetActionState = { error?: string; success?: boolean } | null;

export async function addAssetAction(
  prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const supabase = await createClient();

  const site_id = formData.get("site_id") as string;
  const name = formData.get("name") as string;
  const asset_type = formData.get("asset_type") as string;
  const manufacturer = formData.get("manufacturer") as string | null;
  const model = formData.get("model") as string | null;
  const host = formData.get("host") as string;
  const port = parseInt(formData.get("port") as string, 10) || 502;
  const unit_id = parseInt(formData.get("unit_id") as string, 10) || 1;
  const is_controllable = formData.get("is_controllable") === "true";
  const register_map_str = formData.get("register_map") as string | null;

  let modbus_register_map: Record<string, unknown> = {};
  if (register_map_str) {
    try {
      modbus_register_map = JSON.parse(register_map_str);
    } catch {
      // ignore
    }
  }

  if (!site_id || !name || !host) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  const { error } = await supabase.from("assets").insert({
    site_id,
    name,
    asset_type,
    manufacturer: manufacturer || null,
    model: model || null,
    connection_type: "modbus_tcp",
    connection_params: { host, port, unit_id },
    modbus_register_map,
    is_controllable,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath(`/sites/${site_id}`);
  return { success: true };
}

export async function updateAssetAction(
  prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const supabase = await createClient();

  const asset_id = formData.get("asset_id") as string;
  const site_id = formData.get("site_id") as string;
  const name = formData.get("name") as string;
  const host = formData.get("host") as string;
  const port = parseInt(formData.get("port") as string, 10) || 502;
  const unit_id = parseInt(formData.get("unit_id") as string, 10) || 1;

  if (!asset_id || !name || !host) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  const { error } = await supabase
    .from("assets")
    .update({
      name,
      connection_params: { host, port, unit_id },
    })
    .eq("id", asset_id);

  if (error) return { error: error.message };

  revalidatePath(`/sites/${site_id}`);
  return { success: true };
}

export async function deleteAssetAction(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const asset_id = formData.get("asset_id") as string;
  const site_id = formData.get("site_id") as string;

  if (!asset_id) return;

  const { error } = await supabase.from("assets").delete().eq("id", asset_id);

  if (error) {
    console.error("deleteAssetAction error:", error.message);
    return;
  }

  revalidatePath(`/sites/${site_id}`);
}
