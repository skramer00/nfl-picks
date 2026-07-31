import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  }

  if (new URL(url).hostname !== "anggsolulilezpwecfsm.supabase.co") {
    throw new Error("The server Supabase URL does not match the nfl-picks project.");
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
