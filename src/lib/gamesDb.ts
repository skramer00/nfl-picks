import { supabase } from "./supabaseClient";
import { matchupFavorability } from "./favorability";

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
  away_team: Team;
  home_team: Team;
  away_win_prob: number;
  home_win_prob: number;
  favorability_override_reason: string | null;
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
  game: { id: string; week: number; away_team: Team; home_team: Team },
  overrides: Map<string, FavorabilityOverride>
) {
  const override = overrides.get(game.id);
  if (override) {
    return {
      away: 1 - override.home_win_probability,
      home: override.home_win_probability,
      reason: override.reason,
    };
  }
  const calculated = matchupFavorability(
    game.away_team.abbreviation,
    game.home_team.abbreviation,
    game.week
  );
  return { ...calculated, reason: null };
}

export async function getGamesByWeek(season: number, week: number) {
  const { data, error } = await supabase
    .from("games")
    .select(`
      id,
      week,
      kickoff_at,
      venue,
      status,
      away_team:teams!games_away_team_id_fkey(id, abbreviation, name, conference, division),
      home_team:teams!games_home_team_id_fkey(id, abbreviation, name, conference, division)
    `)
    .eq("season", season)
    .eq("season_type", "REG")
    .eq("week", week)
    .order("kickoff_at", { ascending: true });

  if (error) throw error;
  const games = (data ?? []) as unknown as Omit<ScheduleGame, "away_win_prob" | "home_win_prob">[];
  const overrides = await getFavorabilityOverrides(games.map((game) => game.id));
  return games.map((game) => {
    const favorability = favorabilityForGame(game, overrides);
    return {
      ...game,
      away_win_prob: favorability.away,
      home_win_prob: favorability.home,
      favorability_override_reason: favorability.reason,
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
    Omit<GameRow, "kickoff_iso" | "home_win_prob" | "away_win_prob" | "favorability_override_reason" | "playoff_round"> & {
      kickoff_at: string;
    }
  >;

  const overrides = await getFavorabilityOverrides(games.map((game) => game.id));

  return games.map((game) => {
    const favorability = favorabilityForGame(game, overrides);
    return {
      ...game,
      kickoff_iso: game.kickoff_at,
      home_win_prob: favorability.home,
      away_win_prob: favorability.away,
      favorability_override_reason: favorability.reason,
      playoff_round: null,
    };
  });
}
