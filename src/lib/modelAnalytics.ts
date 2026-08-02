import type { GameRow } from "./gamesDb";
import { DIVISION_MATCHUP_MAX, HOME_FIELD_ELO, teamStrength } from "./favorability";

export function modelFavorite(game: GameRow) {
  const away = game.away_win_prob ?? 0.5;
  const home = game.home_win_prob ?? 0.5;
  return home >= away
    ? { teamId: game.home_team_id, team: game.home_team, probability: home }
    : { teamId: game.away_team_id, team: game.away_team, probability: away };
}

export function modelPerformance(games: GameRow[]) {
  const allFinals = games.filter(
    (game) => game.status === "final" && Boolean(game.winner_team_id)
  );
  const finals = allFinals.filter((game) => game.prediction_snapshot_is_pregame);
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
    unscoredFinals: allFinals.length - finals.length,
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
    (game) =>
      game.status === "final" &&
      Boolean(game.winner_team_id) &&
      game.prediction_snapshot_is_pregame
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
      game.prediction_snapshot_is_pregame &&
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

function probabilityForTeam(game: GameRow, teamId: string) {
  return teamId === game.home_team_id
    ? game.home_win_prob ?? 0.5
    : game.away_win_prob ?? 0.5;
}

type ExplainableMatchup = Pick<
  GameRow,
  | "home_team"
  | "away_team"
  | "home_team_id"
  | "away_team_id"
  | "rest_advantage_team_id"
  | "rest_advantage_days"
  | "favorability_override_reason"
>;

export function matchupExplanation(game: ExplainableMatchup) {
  if (game.favorability_override_reason) {
    return [
      `Manual adjustment: ${game.favorability_override_reason}`,
      "This matchup uses the labeled adjustment instead of the standard model factors.",
    ];
  }

  const homeStrength = teamStrength(game.home_team.abbreviation);
  const awayStrength = teamStrength(game.away_team.abbreviation);
  const strengthTeam = homeStrength >= awayStrength ? game.home_team : game.away_team;
  const difference = Math.abs(homeStrength - awayStrength);
  const isDivisionGame =
    game.home_team.conference === game.away_team.conference &&
    game.home_team.division === game.away_team.division;
  const reasons: string[] = [];

  if (difference < 25) {
    reasons.push("The teams enter with nearly even model strength.");
  } else {
    reasons.push(`${strengthTeam.name} has the stronger model rating.`);
  }
  reasons.push(`${game.home_team.name} receives the home-field edge.`);

  if (game.rest_advantage_team_id && game.rest_advantage_days) {
    const restTeam = game.rest_advantage_team_id === game.home_team_id
      ? game.home_team
      : game.away_team;
    reasons.push(`${restTeam.name} has ${game.rest_advantage_days} more ${game.rest_advantage_days === 1 ? "day" : "days"} of rest.`);
  }
  if (isDivisionGame) {
    reasons.push(`Division-game uncertainty keeps either side from exceeding ${Math.round(DIVISION_MATCHUP_MAX * 100)}%.`);
  }
  return reasons;
}

export function seasonModelInsights(games: GameRow[]) {
  const futureGames = games.filter((game) => game.status !== "final");
  const teams = new Map<string, GameRow["home_team"]>();
  for (const game of games) {
    teams.set(game.home_team_id, game.home_team);
    teams.set(game.away_team_id, game.away_team);
  }

  const matchupRows = futureGames
    .map((game) => ({ game, favorite: modelFavorite(game) }))
    .sort((first, second) => second.favorite.probability - first.favorite.probability);

  const scheduleOutlooks = [...teams.values()].map((team) => {
    const remaining = futureGames.filter(
      (game) => game.home_team_id === team.id || game.away_team_id === team.id
    );
    const expectedWins = remaining.reduce(
      (sum, game) => sum + probabilityForTeam(game, team.id),
      0
    );
    return {
      team,
      games: remaining.length,
      expectedWins,
      favorableRate: remaining.length ? expectedWins / remaining.length : 0,
    };
  }).sort(
    (first, second) =>
      second.favorableRate - first.favorableRate ||
      first.team.name.localeCompare(second.team.name)
  );

  const divisions = new Map<string, { conference: string; division: string; ratings: number[] }>();
  for (const team of teams.values()) {
    const key = `${team.conference} ${team.division}`;
    const row = divisions.get(key) ?? {
      conference: team.conference,
      division: team.division,
      ratings: [],
    };
    row.ratings.push(teamStrength(team.abbreviation));
    divisions.set(key, row);
  }
  const divisionStrength = [...divisions.values()].map((division) => ({
    ...division,
    averageRating: Math.round(
      division.ratings.reduce((sum, rating) => sum + rating, 0) /
        division.ratings.length
    ),
  })).sort((first, second) => second.averageRating - first.averageRating);

  const confidence = [
    { label: "Toss-ups", minimum: 0.5, maximum: 0.55 },
    { label: "Slight edges", minimum: 0.55, maximum: 0.6 },
    { label: "Clear edges", minimum: 0.6, maximum: 0.65 },
    { label: "Strong edges", minimum: 0.65, maximum: 1.01 },
  ].map((bucket) => ({
    label: bucket.label,
    games: matchupRows.filter(({ favorite }) =>
      favorite.probability >= bucket.minimum && favorite.probability < bucket.maximum
    ).length,
  }));

  return {
    biggestFavorites: matchupRows.slice(0, 5),
    closestGames: [...matchupRows]
      .sort((first, second) => first.favorite.probability - second.favorite.probability)
      .slice(0, 5),
    favorableSchedules: scheduleOutlooks.slice(0, 5),
    difficultSchedules: scheduleOutlooks.slice(-5).reverse(),
    strongestDivision: divisionStrength[0] ?? null,
    weakestDivision: divisionStrength.at(-1) ?? null,
    confidence,
    homeFieldElo: HOME_FIELD_ELO,
  };
}
