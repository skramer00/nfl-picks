import { supabase } from "@/lib/supabaseClient";
import type { Json } from "@/lib/database.types";

export type ShareKind = "power_rankings" | "playoffs_model" | "playoffs_user";
export type SharedPrediction = {
  id: string;
  user_id: string;
  kind: ShareKind;
  public_token: string;
  payload: unknown;
  display_name: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export async function getMyShares(userId: string) {
  const { data, error } = await supabase.from("shared_predictions").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as SharedPrediction[];
}

export async function publishShare(input: { userId: string; kind: ShareKind; payload: Json; displayName: string; regenerate?: boolean }) {
  const current = (await getMyShares(input.userId)).find((item) => item.kind === input.kind);
  const row = {
    user_id: input.userId,
    kind: input.kind,
    payload: input.payload,
    display_name: input.displayName || "Pretzel Quest player",
    is_public: true,
    updated_at: new Date().toISOString(),
    ...((input.regenerate || !current) ? { public_token: crypto.randomUUID() } : {}),
  };
  const { data, error } = await supabase.from("shared_predictions").upsert(row, { onConflict: "user_id,kind" }).select("*").single();
  if (error) throw error;
  return data as SharedPrediction;
}

export async function revokeShare(userId: string, kind: ShareKind) {
  const { data, error } = await supabase.from("shared_predictions").update({ is_public: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("kind", kind).select("*").single();
  if (error) throw error;
  return data as SharedPrediction;
}
