import { preseasonTeamStrength } from "./modelRatings";

export const HOME_FIELD_ELO = 55;
export const BASE_K_FACTOR = 24;
export type RatingGame = {
  id: string;
  week: number;
  kickoff_at?: string;
  kickoff_iso?: string;
  updated_at?: string;
  status?: string;
  away_score?: number | null;
  home_score?: number | null;
  venue?: string | null;
  neutral_site?: boolean | null;
  away_team_id: string;
  home_team_id: string;
  away_team: { abbreviation: string };
  home_team: { abbreviation: string };
};

// Provider flags take precedence. Named international venues cover imported schedules
// predating the provider flag; ordinary US venues are never inferred as neutral.
export function isNeutralSite(game: Pick<RatingGame, "venue" | "neutral_site">) {
  return game.neutral_site ?? /Melbourne Cricket|Tottenham|Wembley|Croke Park|Olympiastadion|Santiago Bernab[eé]u|Allianz Arena|Deutsche Bank Park|Arena Corinthians|Estadio Azteca/i.test(game.venue ?? "");
}
export function expectedHomeScore(away: number, home: number, neutral = false) {
  return 1 / (1 + 10 ** ((away - home - (neutral ? 0 : HOME_FIELD_ELO)) / 400));
}
export function resultRatingChange(away: number, home: number, awayScore: number, homeScore: number, neutral = false) {
  const actual = homeScore === awayScore ? 0.5 : Number(homeScore > awayScore);
  const margin = Math.abs(homeScore - awayScore);
  const multiplier = margin ? Math.min(2.5, Math.max(1, Math.log2(margin + 1) / 2)) : 1;
  return BASE_K_FACTOR * multiplier * (actual - expectedHomeScore(away, home, neutral));
}
export function kickoffTime(game: RatingGame) {
  return new Date(game.kickoff_at ?? game.kickoff_iso ?? "").getTime();
}
export function eligibleRatingResults(games: RatingGame[], asOf: Date) {
  return games.filter((game) => game.status === "final" &&
    game.away_score != null && game.home_score != null &&
    kickoffTime(game) < asOf.getTime() &&
    // A final score must have been observed before the prediction. Missing timestamps
    // are excluded from historical/live prediction updates rather than guessed.
    Boolean(game.updated_at) && new Date(game.updated_at!).getTime() <= asOf.getTime())
    .sort((a, b) => kickoffTime(a) - kickoffTime(b) || a.id.localeCompare(b.id));
}
export function buildRatingState(games: RatingGame[], asOf = new Date()) {
  const ratings = new Map<string, number>();
  for (const game of games) for (const [id, team] of [[game.away_team_id, game.away_team], [game.home_team_id, game.home_team]] as const) {
    if (!ratings.has(id)) ratings.set(id, preseasonTeamStrength(team.abbreviation));
  }
  for (const game of eligibleRatingResults(games, asOf)) {
    const away = ratings.get(game.away_team_id)!;
    const home = ratings.get(game.home_team_id)!;
    const change = resultRatingChange(away, home, game.away_score!, game.home_score!, isNeutralSite(game));
    ratings.set(game.away_team_id, away - change);
    ratings.set(game.home_team_id, home + change);
  }
  return ratings;
}
