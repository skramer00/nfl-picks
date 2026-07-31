import { supabase } from "./supabaseClient";
import { matchupFavorability } from "./favorability";

export type Team = {
  id: string;
  abbreviation: string;
  name: string;
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
  playoff_round: string | null;
  updated_at: string;
  away_team: Team;
  home_team: Team;
};

export async function getGamesByWeek(season: number, week: number) {
  const { data, error } = await supabase
    .from("games")
    .select(`
      id,
      week,
      kickoff_at,
      venue,
      status,
      away_team:teams!games_away_team_id_fkey(id, abbreviation, name),
      home_team:teams!games_home_team_id_fkey(id, abbreviation, name)
    `)
    .eq("season", season)
    .eq("season_type", "REG")
    .eq("week", week)
    .order("kickoff_at", { ascending: true });

  if (error) throw error;
  const games = (data ?? []) as unknown as Omit<ScheduleGame, "away_win_prob" | "home_win_prob">[];
  return games.map((game) => {
    const favorability = matchupFavorability(game.away_team.abbreviation, game.home_team.abbreviation);
    return { ...game, away_win_prob: favorability.away, home_win_prob: favorability.home };
  });
}

export async function getGamesBySeason(season: number): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from("games")
    .select(
      `id, season, week, kickoff_at, away_team_id, home_team_id, away_score, home_score,
       status, winner_team_id, updated_at,
       away_team:teams!games_away_team_id_fkey(id, abbreviation, name),
       home_team:teams!games_home_team_id_fkey(id, abbreviation, name)`
    )
    .eq("season", season)
    .order("week", { ascending: true })
    .order("kickoff_at", { ascending: true });

  if (error) throw error;

  const games = (data ?? []) as unknown as Array<
    Omit<GameRow, "kickoff_iso" | "home_win_prob" | "away_win_prob" | "playoff_round"> & {
      kickoff_at: string;
    }
  >;

  return games.map((game) => {
    const favorability = matchupFavorability(game.away_team.abbreviation, game.home_team.abbreviation);
    return {
      ...game,
      kickoff_iso: game.kickoff_at,
      home_win_prob: favorability.home,
      away_win_prob: favorability.away,
      playoff_round: null,
    };
  });
}
