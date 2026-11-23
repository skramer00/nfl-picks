import type { ScheduleGame } from "./gamesDb";

export function pretzelUnderdog(game: ScheduleGame): string | null {
  if (game.home_win_prob === game.away_win_prob) return null;
  return game.home_win_prob < game.away_win_prob ? game.home_team_id : game.away_team_id;
}
