"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type JoinCodeState = {
  code?: string;
  expiresAt?: string;
  error?: string;
} | null;

export async function generateJoinCodeAction(
  prevState: JoinCodeState,
  formData: FormData
): Promise<JoinCodeState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt" };

  // Tenant des eingeloggten Users ermitteln
  const { data: userTenant } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!userTenant) return { error: "Kein Tenant gefunden" };

  const siteName    = formData.get("site_name") as string | null;
  const siteAddress = formData.get("site_address") as string | null;

  // generate_device_join_code DB-Funktion aufrufen
  const { data: code, error } = await supabase.rpc("generate_device_join_code", {
    p_tenant_id:    userTenant.tenant_id,
    p_site_name:    siteName || null,
    p_site_address: siteAddress || null,
  });

  if (error) {
    console.error("Join Code Fehler:", error);
    return { error: "Fehler beim Generieren des Codes" };
  }

  // Ablaufzeit berechnen (15 Minuten)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  revalidatePath("/");

  return { code, expiresAt };
}
