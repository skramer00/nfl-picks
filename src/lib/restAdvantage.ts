const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type RestScheduleGame = {
  id: string;
  week: number;
  kickoff_at: string;
  away_team_id: string;
  home_team_id: string;
};

export type RestAdvantage = {
  awayRestDays: number | null;
  homeRestDays: number | null;
  homeAdvantageDays: number;
};

export function buildRestAdvantageMap(games: RestScheduleGame[]) {
  const lastKickoffByTeam = new Map<string, number>();
  const restByGame = new Map<string, RestAdvantage>();
  const orderedGames = [...games].sort(
    (first, second) =>
      new Date(first.kickoff_at).getTime() - new Date(second.kickoff_at).getTime()
  );

  for (const game of orderedGames) {
    const kickoff = new Date(game.kickoff_at).getTime();
    const awayPreviousKickoff = lastKickoffByTeam.get(game.away_team_id);
    const homePreviousKickoff = lastKickoffByTeam.get(game.home_team_id);
    const awayRestDays =
      awayPreviousKickoff === undefined
        ? null
        : (kickoff - awayPreviousKickoff) / MILLISECONDS_PER_DAY;
    const homeRestDays =
      homePreviousKickoff === undefined
        ? null
        : (kickoff - homePreviousKickoff) / MILLISECONDS_PER_DAY;

    restByGame.set(game.id, {
      awayRestDays,
      homeRestDays,
      homeAdvantageDays:
        game.week >= 3 && awayRestDays !== null && homeRestDays !== null
          ? homeRestDays - awayRestDays
          : 0,
    });

    lastKickoffByTeam.set(game.away_team_id, kickoff);
    lastKickoffByTeam.set(game.home_team_id, kickoff);
  }

  return restByGame;
}
