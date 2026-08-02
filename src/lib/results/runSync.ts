import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { capturePredictionSnapshots } from "../predictionSnapshots";
import { syncResults } from "./sync";

export async function runTrackedSync({
  supabase,
  season,
  weeks,
  source,
  requestedBy = null,
}: {
  supabase: SupabaseClient<Database>;
  season: number;
  weeks: number[];
  source: "cron" | "manual";
  requestedBy?: string | null;
}) {
  const { data: run, error: insertError } = await supabase
    .from("sync_runs")
    .insert({ season, weeks, source, requested_by: requestedBy })
    .select("id")
    .single();

  if (insertError) throw insertError;

  try {
    const snapshots = await capturePredictionSnapshots({
      supabase,
      season,
      weeks,
      source,
    });
    const summary = await syncResults({ supabase, season, weeks });
    const { error: updateError } = await supabase
      .from("sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        provider_games: summary.providerGames,
        matched: summary.matched,
        updated: summary.updated,
        unchanged: summary.unchanged,
        unmatched: summary.unmatched,
      })
      .eq("id", run.id);
    if (updateError) throw updateError;
    return { ...summary, snapshots };
  } catch (error) {
    await supabase
      .from("sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown sync error",
      })
      .eq("id", run.id);
    throw error;
  }
}
