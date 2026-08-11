import "server-only";

import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { ShareKind, SharedPrediction } from "@/lib/sharedPredictions";

export async function getPublicShare(token: string, kind?: ShareKind) {
  const admin = createSupabaseAdmin();
  let query = admin.from("shared_predictions").select("*").eq("public_token", token).eq("is_public", true);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as SharedPrediction | null;
}
