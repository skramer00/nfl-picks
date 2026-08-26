import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { fetchEspnWeek, type ProviderGame } from "./espn";

type TeamRef = { id: string; abbreviation: string };
type GameRef = {
  id: string;
  week: number;
  kickoff_at: string;
  away_team_id: string;
  home_team_id: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  winner_team_id: string | null;
};

export type SyncSummary = {
  season: number;
  weeks: number[];
  providerGames: number;
  matched: number;
  updated: number;
  unchanged: number;
  unmatched: Array<{ week: number; away: string; home: string; providerId: string }>;
  dryRun: boolean;
};

function matchupKey(week: number, awayId: string, homeId: string) {
  return `${week}:${awayId}:${homeId}`;
}

function desiredResult(provider: ProviderGame, game: GameRef) {
  const { homeScore, awayScore } = provider;
  const finalWithScores =
    provider.status === "final" &&
    homeScore !== null &&
    awayScore !== null;

  let winnerTeamId: string | null = null;
  if (finalWithScores && homeScore !== awayScore) {
    winnerTeamId = homeScore > awayScore
      ? game.home_team_id
      : game.away_team_id;
  }

  return {
    kickoff_at: provider.kickoffAt,
    status: provider.status,
    home_score: homeScore,
    away_score: awayScore,
    winner_team_id: winnerTeamId,
    updated_at: new Date().toISOString(),
  };
}

function hasChanged(game: GameRef, result: ReturnType<typeof desiredResult>) {
  return (
    new Date(game.kickoff_at).getTime() !== new Date(result.kickoff_at).getTime() ||
    game.status !== result.status ||
    game.home_score !== result.home_score ||
    game.away_score !== result.away_score ||
    game.winner_team_id !== result.winner_team_id
  );
}

export async function findActiveWeeks(
  supabase: SupabaseClient<Database>,
  season: number,
  now = new Date()
) {
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("games")
    .select("week")
    .eq("season", season)
    .eq("season_type", "REG")
    .gte("kickoff_at", start)
    .lte("kickoff_at", end);

  if (error) throw error;
  return [...new Set((data ?? []).map((game) => game.week))].sort((a, b) => a - b);
}

export async function syncResults({
  supabase,
  season,
  weeks,
  dryRun = false,
  fetchWeek = fetchEspnWeek,
}: {
  supabase: SupabaseClient<Database>;
  season: number;
  weeks: number[];
  dryRun?: boolean;
  fetchWeek?: (season: number, week: number) => Promise<ProviderGame[]>;
}): Promise<SyncSummary> {
  const [{ data: teams, error: teamsError }, { data: games, error: gamesError }] =
    await Promise.all([
      supabase.from("teams").select("id, abbreviation"),
      supabase
        .from("games")
        .select("id, week, kickoff_at, away_team_id, home_team_id, status, away_score, home_score, winner_team_id")
        .eq("season", season)
        .eq("season_type", "REG")
        .in("week", weeks),
    ]);

  if (teamsError) throw teamsError;
  if (gamesError) throw gamesError;

  const teamIdByAbbreviation = new Map(
    ((teams ?? []) as TeamRef[]).map((team) => [team.abbreviation, team.id])
  );
  const gameByMatchup = new Map(
    ((games ?? []) as GameRef[]).map((game) => [
      matchupKey(game.week, game.away_team_id, game.home_team_id),
      game,
    ])
  );

  const providerWeeks = await Promise.all(weeks.map((week) => fetchWeek(season, week)));
  const providerGames = providerWeeks.flat();
  const summary: SyncSummary = {
    season,
    weeks,
    providerGames: providerGames.length,
    matched: 0,
    updated: 0,
    unchanged: 0,
    unmatched: [],
    dryRun,
  };

  for (const provider of providerGames) {
    const awayId = teamIdByAbbreviation.get(provider.away);
    const homeId = teamIdByAbbreviation.get(provider.home);
    const game = awayId && homeId
      ? gameByMatchup.get(matchupKey(provider.week, awayId, homeId))
      : undefined;

    if (!game) {
      summary.unmatched.push({
        week: provider.week,
        away: provider.away,
        home: provider.home,
        providerId: provider.providerId,
      });
      continue;
    }

    summary.matched += 1;
    const result = desiredResult(provider, game);
    if (!hasChanged(game, result)) {
      summary.unchanged += 1;
      continue;
    }

    if (!dryRun) {
      const { error } = await supabase.from("games").update(result).eq("id", game.id);
      if (error) throw error;
    }
    summary.updated += 1;
  }

  return summary;
}
