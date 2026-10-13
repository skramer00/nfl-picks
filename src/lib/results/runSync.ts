import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { capturePredictionSnapshots } from "../predictionSnapshots";
import { refreshQuarterbacks } from "../quarterbackSync";
import { syncResults } from "./sync";
import { getEfficiencyObservations, refreshEfficiency } from "../efficiencySync";
import { fetchPregameMarkets } from "../marketSync";
import type { SnapshotGame } from "../predictionSnapshots";

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
    const summary = await syncResults({ supabase, season, weeks });
    const quarterbacks = await refreshQuarterbacks(supabase, season).catch((error) => {
      console.error("Quarterback refresh failed; freshness checks will mark fallbacks", error);
      return { refreshed: 0, failed: ["provider-unavailable"] };
    });
    const efficiency = await getEfficiencyObservations(supabase, season).catch((error) => {
      console.error("Efficiency archive unavailable; skipping the trial", error);
      return [];
    });
    const { data: upcoming, error: upcomingError } = await supabase.from("games")
      .select("id, season, week, kickoff_at, away_team:teams!games_away_team_id_fkey(abbreviation), home_team:teams!games_home_team_id_fkey(abbreviation)")
      .eq("season", season).eq("season_type", "REG").in("week", weeks).eq("status", "scheduled")
      .gt("kickoff_at", new Date().toISOString()).lte("kickoff_at", new Date(Date.now() + 30 * 3600000).toISOString());
    if (upcomingError) throw upcomingError;
    const markets = await fetchPregameMarkets(upcoming as unknown as SnapshotGame[], season);
    if (upcoming?.length) {
      const { error: healthError } = await supabase.from("model_data_refreshes").upsert({ season, source: "espn-market", attempted_at: new Date().toISOString(),
        status: markets.errors.length ? "error" : "success", row_count: markets.quotes.size,
        error: markets.errors.length ? `${markets.errors.length} games or weeks without a verified pregame moneyline` : null });
      if (healthError) console.error("Market collection status could not be saved", healthError);
    }
    const snapshots = await capturePredictionSnapshots({
      supabase,
      season,
      weeks,
      source,
      efficiency,
      markets: markets.quotes,
    });
    // Collect the larger play-by-play source after the time-sensitive forecasts.
    // Fresh observations enter the next run; a slow provider cannot delay this
    // run's final-hour capture past kickoff.
    const efficiencyRefresh = await refreshEfficiency(supabase, season).catch((error) => {
      console.error("Efficiency refresh failed; using previously observed data", error);
      return { skipped: false, rows: 0, error: "provider-unavailable" };
    });
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
    return { ...summary, snapshots, quarterbacks, efficiency: efficiencyRefresh, markets: { captured: markets.quotes.size, errors: markets.errors } };
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
