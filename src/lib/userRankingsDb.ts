import { supabase } from "@/lib/supabaseClient";

export async function getUserRanking(userId: string) {
  const { data, error } = await supabase.from("user_power_rankings").select("team_order").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.team_order as string[] | undefined) ?? null;
}

export async function saveUserRanking(userId: string, teamOrder: string[]) {
  const { error } = await supabase.from("user_power_rankings").upsert({ user_id: userId, team_order: teamOrder, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
