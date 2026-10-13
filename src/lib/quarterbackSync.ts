import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { normalizeTeamAbbreviation } from "./modelRatings";
import { quarterbackInputFromDepthChart, type DepthChart } from "./quarterbackInputs";

export async function refreshQuarterbacks(supabase: SupabaseClient<Database>, season: number, now = new Date()) {
  const [{ data: games, error }, { data: existing, error: inputError }] = await Promise.all([
    supabase.from("games").select("week,kickoff_at,away_team:teams!games_away_team_id_fkey(abbreviation),home_team:teams!games_home_team_id_fkey(abbreviation)")
      .eq("season", season).eq("season_type", "REG").gte("kickoff_at", now.toISOString()).lte("kickoff_at", new Date(now.getTime() + 7 * 86400000).toISOString()),
    supabase.from("model_quarterback_inputs").select("*").eq("season", season),
  ]);
  if (error || inputError) throw error ?? inputError;
  const targets = new Map<string, { team: string; week: number; kickoff: number }>();
  for (const game of games ?? []) for (const team of [game.away_team, game.home_team]) {
    const key = `${team.abbreviation}:${game.week}`;
    targets.set(key, { team: team.abbreviation, week: game.week, kickoff: new Date(game.kickoff_at).getTime() });
  }
  let refreshed = 0;
  const failed: string[] = [];
  // Small batches keep the result-sync route within its execution budget.
  const pending = [...targets.values()].filter(({ team, week, kickoff }) => {
    const input = existing?.find((row) => row.team_abbreviation === (team === "WAS" ? "WSH" : team) && row.week === week);
    const refreshMinutes = kickoff - now.getTime() < 2 * 3600000 ? 10 : 360;
    return !input || now.getTime() - new Date(input.observed_at).getTime() > refreshMinutes * 60000;
  });
  for (let offset = 0; offset < pending.length; offset += 8) {
    await Promise.all(pending.slice(offset, offset + 8).map(async ({ team, week }) => {
      try {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${normalizeTeamAbbreviation(team).toLowerCase()}/depthcharts`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const input = quarterbackInputFromDepthChart(await response.json() as DepthChart, team, season, week, new Date());
        if (!input) throw new Error("No usable quarterback depth chart");
        const { error } = await supabase.from("model_quarterback_inputs").upsert(input, { onConflict: "season,week,team_abbreviation" });
        if (error) throw error;
        refreshed++;
      } catch { failed.push(`${team}:W${week}`); }
    }));
  }
  return { refreshed, failed };
}
