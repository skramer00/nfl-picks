import { teamStrength } from "./favorability";
import type { GameRow, Team } from "./gamesDb";

import { eligibleRatingResults, isNeutralSite, resultRatingChange } from "./ratingEngine";

export type PowerRanking = Team & {
  rank: number;
  previousRank: number;
  movement: number;
  rating: number;
  ratingChange: number;
  wins: number;
  losses: number;
  ties: number;
};

type TeamState = Team & {
  rating: number;
  wins: number;
  losses: number;
  ties: number;
};

function ordered(states: Iterable<TeamState>) {
  return [...states].sort(
    (first, second) =>
      second.rating - first.rating || first.name.localeCompare(second.name)
  );
}

function ranksByTeam(states: Iterable<TeamState>) {
  return new Map(ordered(states).map((team, index) => [team.id, index + 1]));
}

function finalOutcome(game: GameRow) {
  if (game.away_score !== null && game.home_score !== null) {
    if (game.home_score === game.away_score) return 0.5;
    return game.home_score > game.away_score ? 1 : 0;
  }
  if (game.winner_team_id === game.home_team_id) return 1;
  if (game.winner_team_id === game.away_team_id) return 0;
  return 0.5;
}

export function buildPowerRankings(games: GameRow[]) {
  const states = new Map<string, TeamState>();
  for (const game of games) {
    for (const team of [game.away_team, game.home_team]) {
      if (!states.has(team.id)) {
        states.set(team.id, {
          ...team,
          rating: teamStrength(team.abbreviation),
          wins: 0,
          losses: 0,
          ties: 0,
        });
      }
    }
  }

  const finalGames = eligibleRatingResults(games, new Date()) as GameRow[];
  const latestCompletedWeek = finalGames.length
    ? Math.max(...finalGames.map((game) => game.week))
    : null;
  let previousRanks = ranksByTeam(states.values());

  for (const game of finalGames) {
    const away = states.get(game.away_team_id);
    const home = states.get(game.home_team_id);
    if (!away || !home) continue;

    const actualHome = finalOutcome(game);
    const change = resultRatingChange(away.rating, home.rating, game.away_score!, game.home_score!, isNeutralSite(game));
    home.rating += change;
    away.rating -= change;

    if (actualHome === 0.5) {
      home.ties += 1;
      away.ties += 1;
    } else if (actualHome === 1) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }

    if (latestCompletedWeek !== null && game.week < latestCompletedWeek) {
      previousRanks = ranksByTeam(states.values());
    }
  }

  return ordered(states.values()).map((team, index): PowerRanking => {
    const rank = index + 1;
    const previousRank = previousRanks.get(team.id) ?? rank;
    return {
      ...team,
      rank,
      previousRank,
      movement: previousRank - rank,
      rating: Math.round(team.rating),
      ratingChange: Math.round(team.rating - teamStrength(team.abbreviation)),
    };
  });
}
