import { supabase } from "./supabaseClient";
import { matchupFavorability } from "./favorability";
import { buildRestAdvantageMap, type RestAdvantage, type RestScheduleGame } from "./restAdvantage";

export type Team = {
  id: string;
  abbreviation: string;
  name: string;
  conference: string;
  division: string;
};

export type ScheduleGame = {
  id: string;
  week: number;
  kickoff_at: string;
  venue: string | null;
  status: string;
  away_team_id: string;
  home_team_id: string;
  away_team: Team;
  home_team: Team;
  away_win_prob: number;
  home_win_prob: number;
  favorability_override_reason: string | null;
  rest_advantage_team_id: string | null;
  rest_advantage_days: number | null;
  rest_adjustment: number;
};

// Compatibility shape used by the existing admin and My Picks screens.
export type GameRow = {
  id: string;
  season: number;
  week: number;
  kickoff_iso: string;
  away_team_id: string;
  home_team_id: string;
  away_score: number | null;
  home_score: number | null;
  status: string;
  winner_team_id: string | null;
  home_win_prob: number | null;
  away_win_prob: number | null;
  favorability_override_reason: string | null;
  rest_advantage_team_id: string | null;
  rest_advantage_days: number | null;
  rest_adjustment: number;
  playoff_round: string | null;
  updated_at: string;
  away_team: Team;
  home_team: Team;
};

type FavorabilityOverride = {
  game_id: string;
  home_win_probability: number;
  reason: string;
};

async function getFavorabilityOverrides(gameIds: string[]) {
  if (gameIds.length === 0) return new Map<string, FavorabilityOverride>();
  const { data, error } = await supabase
    .from("favorability_overrides")
    .select("game_id, home_win_probability, reason")
    .in("game_id", gameIds);
  if (error) throw error;
  return new Map((data ?? []).map((override) => [override.game_id, override]));
}

function favorabilityForGame(
  game: { id: string; week: number; away_team_id: string; home_team_id: string; away_team: Team; home_team: Team },
  overrides: Map<string, FavorabilityOverride>,
  rest?: RestAdvantage
) {
  const override = overrides.get(game.id);
  if (override) {
    return {
      away: 1 - override.home_win_probability,
      home: override.home_win_probability,
      reason: override.reason,
      restAdvantageTeamId: null,
      restAdvantageDays: null,
      restAdjustment: 0,
    };
  }
  const calculated = matchupFavorability(
    game.away_team.abbreviation,
    game.home_team.abbreviation,
    game.week,
    rest?.homeAdvantageDays ?? 0
  );
  const restAdvantageDays = Math.abs(rest?.homeAdvantageDays ?? 0);
  return {
    ...calculated,
    reason: null,
    restAdvantageTeamId:
      restAdvantageDays > 0
        ? rest!.homeAdvantageDays > 0
          ? game.home_team_id
          : game.away_team_id
        : null,
    restAdvantageDays: restAdvantageDays > 0 ? restAdvantageDays : null,
    restAdjustment: Math.abs(calculated.restAdjustment),
  };
}

export async function getGamesByWeek(season: number, week: number) {
  const [weekResult, scheduleResult] = await Promise.all([
    supabase.from("games").select(`
      id,
      week,
      kickoff_at,
      away_team_id,
      home_team_id,
      venue,
      status,
      away_team:teams!games_away_team_id_fkey(id, abbreviation, name, conference, division),
      home_team:teams!games_home_team_id_fkey(id, abbreviation, name, conference, division)
    `)
    .eq("season", season)
    .eq("season_type", "REG")
    .eq("week", week)
    .order("kickoff_at", { ascending: true }),
    supabase
      .from("games")
      .select("id, week, kickoff_at, away_team_id, home_team_id")
      .eq("season", season)
      .eq("season_type", "REG")
      .order("kickoff_at", { ascending: true }),
  ]);

  if (weekResult.error) throw weekResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  const games = (weekResult.data ?? []) as unknown as Omit<ScheduleGame, "away_win_prob" | "home_win_prob" | "favorability_override_reason" | "rest_advantage_team_id" | "rest_advantage_days" | "rest_adjustment">[];
  const restByGame = buildRestAdvantageMap((scheduleResult.data ?? []) as RestScheduleGame[]);
  const overrides = await getFavorabilityOverrides(games.map((game) => game.id));
  return games.map((game) => {
    const favorability = favorabilityForGame(game, overrides, restByGame.get(game.id));
    return {
      ...game,
      away_win_prob: favorability.away,
      home_win_prob: favorability.home,
      favorability_override_reason: favorability.reason,
      rest_advantage_team_id: favorability.restAdvantageTeamId,
      rest_advantage_days: favorability.restAdvantageDays,
      rest_adjustment: favorability.restAdjustment,
    };
  });
}

export async function getGamesBySeason(season: number): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from("games")
    .select(
      `id, season, week, kickoff_at, away_team_id, home_team_id, away_score, home_score,
       status, winner_team_id, updated_at,
       away_team:teams!games_away_team_id_fkey(id, abbreviation, name, conference, division),
       home_team:teams!games_home_team_id_fkey(id, abbreviation, name, conference, division)`
    )
    .eq("season", season)
    .order("week", { ascending: true })
    .order("kickoff_at", { ascending: true });

  if (error) throw error;

  const games = (data ?? []) as unknown as Array<
    Omit<GameRow, "kickoff_iso" | "home_win_prob" | "away_win_prob" | "favorability_override_reason" | "rest_advantage_team_id" | "rest_advantage_days" | "rest_adjustment" | "playoff_round"> & {
      kickoff_at: string;
    }
  >;

  const overrides = await getFavorabilityOverrides(games.map((game) => game.id));
  const restByGame = buildRestAdvantageMap(games);

  return games.map((game) => {
    const favorability = favorabilityForGame(game, overrides, restByGame.get(game.id));
    return {
      ...game,
      kickoff_iso: game.kickoff_at,
      home_win_prob: favorability.home,
      away_win_prob: favorability.away,
      favorability_override_reason: favorability.reason,
      rest_advantage_team_id: favorability.restAdvantageTeamId,
      rest_advantage_days: favorability.restAdvantageDays,
      rest_adjustment: favorability.restAdjustment,
      playoff_round: null,
    };
  });
}
