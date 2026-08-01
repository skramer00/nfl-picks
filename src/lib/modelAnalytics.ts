import type { GameRow } from "./gamesDb";

export function modelFavorite(game: GameRow) {
  const away = game.away_win_prob ?? 0.5;
  const home = game.home_win_prob ?? 0.5;
  return home >= away
    ? { teamId: game.home_team_id, team: game.home_team, probability: home }
    : { teamId: game.away_team_id, team: game.away_team, probability: away };
}

export function modelPerformance(games: GameRow[]) {
  const finals = games.filter(
    (game) => game.status === "final" && Boolean(game.winner_team_id)
  );
  const correct = finals.filter(
    (game) => modelFavorite(game).teamId === game.winner_team_id
  ).length;
  const weekly = new Map<number, { correct: number; total: number }>();

  for (const game of finals) {
    const row = weekly.get(game.week) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (modelFavorite(game).teamId === game.winner_team_id) row.correct += 1;
    weekly.set(game.week, row);
  }

  return {
    finals: finals.length,
    correct,
    accuracy: finals.length ? Math.round((correct / finals.length) * 100) : null,
    favoriteWins: correct,
    underdogWins: finals.length - correct,
    weekly: [...weekly.entries()].map(([week, result]) => ({ week, ...result })),
  };
}

export function pickDisagreements(
  games: GameRow[],
  picks: Record<string, string>
) {
  return games
    .filter((game) => game.status !== "final" && picks[game.id])
    .map((game) => ({ game, favorite: modelFavorite(game), pickedTeamId: picks[game.id] }))
    .filter(({ favorite, pickedTeamId }) => favorite.teamId !== pickedTeamId)
    .sort((first, second) => second.favorite.probability - first.favorite.probability);
}

export function projectedTeamRecord(games: GameRow[], teamId: string) {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const game of games) {
    if (game.away_team_id !== teamId && game.home_team_id !== teamId) continue;
    if (
      game.status === "final" &&
      game.away_score !== null &&
      game.home_score !== null &&
      game.away_score === game.home_score
    ) {
      ties += 1;
      continue;
    }
    const winner = game.status === "final" ? game.winner_team_id : modelFavorite(game).teamId;
    if (winner === teamId) wins += 1;
    else losses += 1;
  }

  return { wins, losses, ties };
}
