import { teamStrength } from "./favorability";
import type { GameRow, Team } from "./gamesDb";

export type ProjectionMode = "model" | "user";

export type ProjectedTeam = Team & {
  wins: number;
  losses: number;
  ties: number;
  seed: number;
  divisionWinner: boolean;
};

export type ConferenceProjection = {
  conference: "AFC" | "NFC";
  teams: ProjectedTeam[];
};

type Standing = Team & { wins: number; losses: number; ties: number };

function compareTeams(a: Standing, b: Standing) {
  const aPct = (a.wins + a.ties * 0.5) / Math.max(1, a.wins + a.losses + a.ties);
  const bPct = (b.wins + b.ties * 0.5) / Math.max(1, b.wins + b.losses + b.ties);
  return bPct - aPct || teamStrength(b.abbreviation) - teamStrength(a.abbreviation) || a.name.localeCompare(b.name);
}

function projectedWinner(game: GameRow, picks: Record<string, string>) {
  if (game.status === "final") return game.winner_team_id;
  return picks[game.id] ?? null;
}

export function picksProgress(games: GameRow[], picks: Record<string, string>) {
  const completed = games.filter((game) => game.status === "final").length;
  const future = games.filter((game) => game.status !== "final");
  const futurePicked = future.filter((game) => Boolean(picks[game.id])).length;
  return {
    completed,
    futurePicked,
    futureRequired: future.length,
    resolved: completed + futurePicked,
    total: games.length,
    complete: futurePicked === future.length && games.length > 0,
  };
}

export function buildPostseasonProjection(
  games: GameRow[],
  picks: Record<string, string>,
  mode: ProjectionMode
): ConferenceProjection[] {
  const standings = new Map<string, Standing>();

  for (const game of games) {
    for (const team of [game.away_team, game.home_team]) {
      if (!standings.has(team.id)) standings.set(team.id, { ...team, wins: 0, losses: 0, ties: 0 });
    }

    const away = standings.get(game.away_team_id)!;
    const home = standings.get(game.home_team_id)!;

    if (game.status !== "final" && mode === "model") {
      const homeChance = game.home_win_prob ?? 0.5;
      const awayChance = 1 - homeChance;
      home.wins += homeChance;
      home.losses += awayChance;
      away.wins += awayChance;
      away.losses += homeChance;
      continue;
    }

    const winner = projectedWinner(game, picks);

    if (!winner && game.status === "final" && game.away_score === game.home_score) {
      away.ties += 1;
      home.ties += 1;
    } else if (winner === away.id) {
      away.wins += 1;
      home.losses += 1;
    } else if (winner === home.id) {
      home.wins += 1;
      away.losses += 1;
    }
  }

  return (["AFC", "NFC"] as const).map((conference) => {
    const conferenceTeams = [...standings.values()].filter((team) => team.conference === conference);
    const divisionWinners = ["East", "North", "South", "West"]
      .map((division) => conferenceTeams.filter((team) => team.division === division).sort(compareTeams)[0])
      .filter((team): team is Standing => Boolean(team))
      .sort(compareTeams);
    const divisionWinnerIds = new Set(divisionWinners.map((team) => team.id));
    const wildCards = conferenceTeams
      .filter((team) => !divisionWinnerIds.has(team.id))
      .sort(compareTeams)
      .slice(0, 3);

    const teams = [...divisionWinners, ...wildCards].map((team, index) => ({
      ...team,
      seed: index + 1,
      divisionWinner: index < divisionWinners.length,
    }));
    return { conference, teams };
  });
}
