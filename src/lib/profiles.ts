import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function loadProfilesMap(
  supabase: SupabaseClient<Database>,
): Promise<Record<string, string>> {
  const { data } = await supabase.from("profiles").select("id, name");
  const map: Record<string, string> = {};
  (data ?? []).forEach((p) => {
    map[p.id] = p.name;
  });
  return map;
}
