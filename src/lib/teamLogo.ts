import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function teamLogoUrl(
  supabase: SupabaseClient<Database>,
  logoPath: string | null | undefined,
): string | null {
  if (!logoPath) return null;
  return supabase.storage.from("team-logos").getPublicUrl(logoPath).data.publicUrl;
}
