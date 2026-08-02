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

export type ConfidenceBucket = {
  label: string;
  minimum: number;
  maximum: number;
  games: number;
  correct: number;
  accuracy: number | null;
  averageConfidence: number | null;
};

const confidenceRanges = [
  { label: "Toss-up", minimum: 0.5, maximum: 0.5499 },
  { label: "Slight edge", minimum: 0.55, maximum: 0.5999 },
  { label: "Clear edge", minimum: 0.6, maximum: 0.6499 },
  { label: "Strong edge", minimum: 0.65, maximum: 1 },
];

export function confidenceCalibration(games: GameRow[]): ConfidenceBucket[] {
  const finals = games.filter(
    (game) => game.status === "final" && Boolean(game.winner_team_id)
  );

  return confidenceRanges.map((range) => {
    const rows = finals.filter((game) => {
      const confidence = modelFavorite(game).probability;
      return confidence >= range.minimum && confidence <= range.maximum;
    });
    const correct = rows.filter(
      (game) => modelFavorite(game).teamId === game.winner_team_id
    ).length;
    const averageConfidence = rows.length
      ? Math.round(
          (rows.reduce((sum, game) => sum + modelFavorite(game).probability, 0) /
            rows.length) *
            100
        )
      : null;

    return {
      ...range,
      games: rows.length,
      correct,
      accuracy: rows.length ? Math.round((correct / rows.length) * 100) : null,
      averageConfidence,
    };
  });
}

export function userPickPerformance(
  games: GameRow[],
  picks: Record<string, string>
) {
  const finals = games.filter(
    (game) =>
      game.status === "final" &&
      Boolean(game.winner_team_id) &&
      Boolean(picks[game.id])
  );
  const withModel = finals.filter(
    (game) => picks[game.id] === modelFavorite(game).teamId
  );
  const againstModel = finals.filter(
    (game) => picks[game.id] !== modelFavorite(game).teamId
  );
  const result = (rows: GameRow[]) => {
    const wins = rows.filter((game) => picks[game.id] === game.winner_team_id).length;
    return {
      picks: rows.length,
      correct: wins,
      accuracy: rows.length ? Math.round((wins / rows.length) * 100) : null,
    };
  };

  return {
    ...result(finals),
    withModel: result(withModel),
    againstModel: result(againstModel),
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
  let expectedWins = 0;
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
    if (game.status === "final") {
      expectedWins += game.winner_team_id === teamId ? 1 : 0;
      continue;
    }
    expectedWins += game.home_team_id === teamId
      ? game.home_win_prob ?? 0.5
      : game.away_win_prob ?? 0.5;
  }

  const decisiveGames = games.length - ties;
  const wins = Math.min(decisiveGames, Math.max(0, Math.round(expectedWins)));
  const losses = decisiveGames - wins;
  return { wins, losses, ties };
}
