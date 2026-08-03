import { teamStrength } from "./favorability";
import type { GameRow, Team } from "./gamesDb";
import { projectPlayoffs } from "./playoffs";
import type { Game } from "./season";

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

export type PlayoffOutlookTeam = Standing & {
  chance: number;
  eliminated: boolean;
};

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

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function normalizedTeam(abbreviation: string) {
  return abbreviation === "WAS" ? "WSH" : abbreviation;
}

function playoffEngineGames(games: GameRow[]): Game[] {
  return games.map((game) => {
    const isFinal = game.status === "final";
    const isTie =
      isFinal &&
      game.away_score !== null &&
      game.home_score !== null &&
      game.away_score === game.home_score;
    const winner =
      game.winner_team_id === game.away_team_id
        ? normalizedTeam(game.away_team.abbreviation)
        : game.winner_team_id === game.home_team_id
          ? normalizedTeam(game.home_team.abbreviation)
          : null;
    return {
      id: game.id,
      week: game.week,
      kickoffISO: game.kickoff_iso,
      awayTeam: normalizedTeam(game.away_team.abbreviation),
      homeTeam: normalizedTeam(game.home_team.abbreviation),
      status: isFinal ? "final" : "scheduled",
      winner,
      isTie,
      awayScore: game.away_score,
      homeScore: game.home_score,
    };
  });
}

export function playoffChances(games: GameRow[], simulations = 2000) {
  const teams = new Map<string, Team>();
  for (const game of games) {
    teams.set(game.home_team_id, game.home_team);
    teams.set(game.away_team_id, game.away_team);
  }
  const appearances = new Map([...teams.keys()].map((id) => [id, 0]));
  const teamIdByAbbreviation = new Map(
    [...teams].map(([id, team]) => [normalizedTeam(team.abbreviation), id]),
  );
  const engineGames = playoffEngineGames(games);
  const useFullTiebreakers = teams.size === 32;
  const random = seededRandom(2026);

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const simulatedPicks: Record<string, string> = {};
    const simulatedTeamIds: Record<string, string> = {};
    for (const game of games) {
      if (game.status === "final") continue;
      const homeChance = game.home_win_prob ?? 0.5;
      const homeWins = random() < homeChance;
      simulatedPicks[game.id] = homeWins
        ? normalizedTeam(game.home_team.abbreviation)
        : normalizedTeam(game.away_team.abbreviation);
      simulatedTeamIds[game.id] = homeWins ? game.home_team_id : game.away_team_id;
    }
    if (useFullTiebreakers) {
      const projection = projectPlayoffs(simulatedPicks, engineGames);
      for (const conference of Object.values(projection.conferences)) {
        for (const seed of conference.seeds) {
          const teamId = teamIdByAbbreviation.get(seed.team);
          if (teamId) appearances.set(teamId, (appearances.get(teamId) ?? 0) + 1);
        }
      }
    } else {
      for (const conference of buildPostseasonProjection(games, simulatedTeamIds, "user")) {
        for (const team of conference.teams) {
          appearances.set(team.id, (appearances.get(team.id) ?? 0) + 1);
        }
      }
    }
  }

  return new Map(
    [...appearances].map(([id, count]) => [id, Math.round((count / simulations) * 100)])
  );
}

export function buildPlayoffHunt(
  games: GameRow[],
  projection: ConferenceProjection[],
  chances: Map<string, number>
) {
  const actual = new Map<string, Standing>();
  const remaining = new Map<string, number>();
  const projected = new Map<string, Standing>();

  for (const game of games) {
    for (const team of [game.away_team, game.home_team]) {
      if (!actual.has(team.id)) {
        actual.set(team.id, { ...team, wins: 0, losses: 0, ties: 0 });
        projected.set(team.id, { ...team, wins: 0, losses: 0, ties: 0 });
        remaining.set(team.id, 0);
      }
    }
    if (game.status !== "final") {
      remaining.set(game.away_team_id, (remaining.get(game.away_team_id) ?? 0) + 1);
      remaining.set(game.home_team_id, (remaining.get(game.home_team_id) ?? 0) + 1);
      const homeChance = game.home_win_prob ?? 0.5;
      projected.get(game.home_team_id)!.wins += homeChance;
      projected.get(game.home_team_id)!.losses += 1 - homeChance;
      projected.get(game.away_team_id)!.wins += 1 - homeChance;
      projected.get(game.away_team_id)!.losses += homeChance;
      continue;
    }
    const actualAway = actual.get(game.away_team_id)!;
    const actualHome = actual.get(game.home_team_id)!;
    const projectedAway = projected.get(game.away_team_id)!;
    const projectedHome = projected.get(game.home_team_id)!;
    if (game.winner_team_id === game.away_team_id) {
      actualAway.wins += 1; projectedAway.wins += 1;
      actualHome.losses += 1; projectedHome.losses += 1;
    } else if (game.winner_team_id === game.home_team_id) {
      actualHome.wins += 1; projectedHome.wins += 1;
      actualAway.losses += 1; projectedAway.losses += 1;
    } else {
      actualAway.ties += 1; actualHome.ties += 1;
      projectedAway.ties += 1; projectedHome.ties += 1;
    }
  }

  return projection.map((conferenceProjection) => {
    const selected = new Set(conferenceProjection.teams.map((team) => team.id));
    const conferenceActual = [...actual.values()].filter(
      (team) => team.conference === conferenceProjection.conference
    );
    const teams = [...projected.values()]
      .filter((team) => team.conference === conferenceProjection.conference && !selected.has(team.id))
      .sort(compareTeams)
      .map((team): PlayoffOutlookTeam => {
        const current = actual.get(team.id)!;
        const maximumWins = current.wins + (remaining.get(team.id) ?? 0);
        const teamsAlreadyAboveMaximum = conferenceActual.filter(
          (opponent) => opponent.id !== team.id && opponent.wins > maximumWins
        ).length;
        return {
          ...team,
          chance: chances.get(team.id) ?? 0,
          eliminated: teamsAlreadyAboveMaximum >= 7,
        };
      });
    return {
      conference: conferenceProjection.conference,
      teams: teams.filter((team) => !team.eliminated),
    };
  });
}
