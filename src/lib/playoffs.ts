import {
  ALL_GAMES,
  Conference,
  DIVISIONS,
  Division,
  Game,
  TEAM_BY_ABBR,
  TEAMS,
} from "@/lib/season";

export type ProjectionPicks = Record<string, string>;

type RecordLine = {
  wins: number;
  losses: number;
  ties: number;
};

export type TeamStanding = RecordLine & {
  team: string;
  gamesResolved: number;
  gamesUnresolved: number;
  winPct: number;
  division: RecordLine;
  conference: RecordLine;
  pointsFor: number;
  pointsAgainst: number;
  hasCompleteScores: boolean;
};

export type TieDecision = {
  winner: string;
  criterion: string;
  detail: string;
  provisional: boolean;
};

export type PlayoffSeed = {
  seed: number;
  team: string;
  berth: "Division" | "Wild card";
  standing: TeamStanding;
  tiebreaker?: TieDecision;
};

export type ConferenceProjection = {
  conference: Conference;
  seeds: PlayoffSeed[];
  divisions: Record<string, TeamStanding[]>;
};

export type PlayoffProjection = {
  conferences: Record<Conference, ConferenceProjection>;
  completedSelections: number;
  totalGames: number;
  unresolvedGames: number;
  provisionalTies: TieDecision[];
};

type ResolvedGame = Game & {
  projected: boolean;
  resolvedWinner: string | null;
  resolvedTie: boolean;
};

type EngineContext = {
  games: Game[];
  resolvedGames: ResolvedGame[];
  standings: Record<string, TeamStanding>;
  opponents: Record<string, Set<string>>;
  divisionOrder: Record<string, number>;
  provisionalTies: TieDecision[];
};

const EPSILON = 0.0000001;

function recordPct(record: RecordLine) {
  const games = record.wins + record.losses + record.ties;
  return games === 0 ? 0 : (record.wins + record.ties / 2) / games;
}

function freshStanding(team: string): TeamStanding {
  return {
    team,
    wins: 0,
    losses: 0,
    ties: 0,
    gamesResolved: 0,
    gamesUnresolved: 0,
    winPct: 0,
    division: { wins: 0, losses: 0, ties: 0 },
    conference: { wins: 0, losses: 0, ties: 0 },
    pointsFor: 0,
    pointsAgainst: 0,
    hasCompleteScores: true,
  };
}

function opponentOf(game: Game, team: string) {
  return game.homeTeam === team ? game.awayTeam : game.homeTeam;
}

function addOutcome(record: RecordLine, outcome: "win" | "loss" | "tie") {
  if (outcome === "win") record.wins += 1;
  else if (outcome === "loss") record.losses += 1;
  else record.ties += 1;
}

function resolveGames(games: Game[], picks: ProjectionPicks): ResolvedGame[] {
  return games.map((game) => {
    if (game.status === "final" && (game.winner || game.isTie)) {
      return {
        ...game,
        projected: false,
        resolvedWinner: game.winner,
        resolvedTie: game.isTie,
      };
    }
    return {
      ...game,
      projected: true,
      resolvedWinner: picks[game.id] ?? null,
      resolvedTie: false,
    };
  });
}

function buildStandings(resolvedGames: ResolvedGame[]) {
  const standings = Object.fromEntries(
    TEAMS.map((entry) => [entry.abbreviation, freshStanding(entry.abbreviation)]),
  ) as Record<string, TeamStanding>;

  for (const game of resolvedGames) {
    const away = standings[game.awayTeam];
    const home = standings[game.homeTeam];
    const sameDivision =
      TEAM_BY_ABBR[game.awayTeam].division === TEAM_BY_ABBR[game.homeTeam].division;
    const sameConference =
      TEAM_BY_ABBR[game.awayTeam].conference === TEAM_BY_ABBR[game.homeTeam].conference;

    if (!game.resolvedWinner && !game.resolvedTie) {
      away.gamesUnresolved += 1;
      home.gamesUnresolved += 1;
      away.hasCompleteScores = false;
      home.hasCompleteScores = false;
      continue;
    }

    away.gamesResolved += 1;
    home.gamesResolved += 1;
    if (game.projected || game.awayScore === null || game.homeScore === null) {
      away.hasCompleteScores = false;
      home.hasCompleteScores = false;
    } else {
      away.pointsFor += game.awayScore;
      away.pointsAgainst += game.homeScore;
      home.pointsFor += game.homeScore;
      home.pointsAgainst += game.awayScore;
    }

    const awayOutcome = game.resolvedTie
      ? "tie"
      : game.resolvedWinner === game.awayTeam
        ? "win"
        : "loss";
    const homeOutcome = game.resolvedTie
      ? "tie"
      : game.resolvedWinner === game.homeTeam
        ? "win"
        : "loss";

    addOutcome(away, awayOutcome);
    addOutcome(home, homeOutcome);
    if (sameDivision) {
      addOutcome(away.division, awayOutcome);
      addOutcome(home.division, homeOutcome);
    }
    if (sameConference) {
      addOutcome(away.conference, awayOutcome);
      addOutcome(home.conference, homeOutcome);
    }
  }

  for (const standing of Object.values(standings)) {
    standing.winPct = recordPct(standing);
  }
  return standings;
}

function buildOpponents(games: Game[]) {
  const opponents = Object.fromEntries(
    TEAMS.map((entry) => [entry.abbreviation, new Set<string>()]),
  ) as Record<string, Set<string>>;
  for (const game of games) {
    opponents[game.awayTeam].add(game.homeTeam);
    opponents[game.homeTeam].add(game.awayTeam);
  }
  return opponents;
}

function gamesForTeam(ctx: EngineContext, team: string) {
  return ctx.resolvedGames.filter(
    (game) =>
      (game.awayTeam === team || game.homeTeam === team) &&
      Boolean(game.resolvedWinner || game.resolvedTie),
  );
}

function subsetRecord(
  ctx: EngineContext,
  team: string,
  include: (game: ResolvedGame, opponent: string) => boolean,
) {
  const record: RecordLine = { wins: 0, losses: 0, ties: 0 };
  for (const game of gamesForTeam(ctx, team)) {
    const opponent = opponentOf(game, team);
    if (!include(game, opponent)) continue;
    if (game.resolvedTie) addOutcome(record, "tie");
    else addOutcome(record, game.resolvedWinner === team ? "win" : "loss");
  }
  const games = record.wins + record.losses + record.ties;
  return { record, games, pct: games ? recordPct(record) : null };
}

function commonOpponents(ctx: EngineContext, teams: string[]) {
  const [first, ...rest] = teams;
  return new Set(
    [...ctx.opponents[first]].filter((opponent) =>
      rest.every((team) => ctx.opponents[team].has(opponent)),
    ),
  );
}

function strengthOfVictory(ctx: EngineContext, team: string) {
  const aggregate: RecordLine = { wins: 0, losses: 0, ties: 0 };
  let defeated = 0;
  for (const game of gamesForTeam(ctx, team)) {
    if (game.resolvedWinner !== team) continue;
    const opponent = ctx.standings[opponentOf(game, team)];
    aggregate.wins += opponent.wins;
    aggregate.losses += opponent.losses;
    aggregate.ties += opponent.ties;
    defeated += 1;
  }
  return defeated ? recordPct(aggregate) : 0;
}

function strengthOfSchedule(ctx: EngineContext, team: string) {
  const aggregate: RecordLine = { wins: 0, losses: 0, ties: 0 };
  for (const game of gamesForTeam(ctx, team)) {
    const opponent = ctx.standings[opponentOf(game, team)];
    aggregate.wins += opponent.wins;
    aggregate.losses += opponent.losses;
    aggregate.ties += opponent.ties;
  }
  return recordPct(aggregate);
}

function scoringDataComplete(ctx: EngineContext) {
  return Object.values(ctx.standings).every(
    (standing) => standing.gamesUnresolved === 0 && standing.hasCompleteScores,
  );
}

function rankedPosition(values: { team: string; value: number }[], team: string, lowerWins: boolean) {
  const sorted = [...values].sort((a, b) =>
    lowerWins ? a.value - b.value : b.value - a.value,
  );
  const value = sorted.find((entry) => entry.team === team)?.value;
  return value === undefined ? null : sorted.findIndex((entry) => entry.value === value) + 1;
}

function combinedPointsRank(ctx: EngineContext, team: string, conferenceOnly: boolean) {
  if (!scoringDataComplete(ctx)) return null;
  const conference = TEAM_BY_ABBR[team].conference;
  const field = TEAMS.filter(
    (entry) => !conferenceOnly || entry.conference === conference,
  ).map((entry) => entry.abbreviation);
  const scored = field.map((entry) => ({
    team: entry,
    value: ctx.standings[entry].pointsFor,
  }));
  const allowed = field.map((entry) => ({
    team: entry,
    value: ctx.standings[entry].pointsAgainst,
  }));
  const scoredRank = rankedPosition(scored, team, false);
  const allowedRank = rankedPosition(allowed, team, true);
  return scoredRank === null || allowedRank === null ? null : scoredRank + allowedRank;
}

function netPoints(
  ctx: EngineContext,
  team: string,
  include: (game: ResolvedGame, opponent: string) => boolean,
) {
  if (!scoringDataComplete(ctx)) return null;
  let points = 0;
  for (const game of gamesForTeam(ctx, team)) {
    const opponent = opponentOf(game, team);
    if (!include(game, opponent)) continue;
    points +=
      game.homeTeam === team
        ? (game.homeScore ?? 0) - (game.awayScore ?? 0)
        : (game.awayScore ?? 0) - (game.homeScore ?? 0);
  }
  return points;
}

type Criterion = {
  label: string;
  value: (team: string) => number | null;
  lowerWins?: boolean;
};

function formatMetric(value: number) {
  return value >= 0 && value <= 1 ? value.toFixed(3).replace(/^0/, "") : String(value);
}

function applyCriteria(
  teams: string[],
  criteria: Criterion[],
  restart: (remaining: string[]) => TieDecision,
  fallbackLabel: string,
  ctx: EngineContext,
): TieDecision {
  for (const criterion of criteria) {
    const values = teams.map((team) => ({ team, value: criterion.value(team) }));
    if (values.some((entry) => entry.value === null)) continue;
    const numericValues = values as { team: string; value: number }[];
    const target = criterion.lowerWins
      ? Math.min(...numericValues.map((entry) => entry.value))
      : Math.max(...numericValues.map((entry) => entry.value));
    const remaining = numericValues
      .filter((entry) => Math.abs(entry.value - target) < EPSILON)
      .map((entry) => entry.team);
    if (remaining.length === teams.length) continue;
    if (remaining.length === 1) {
      return {
        winner: remaining[0],
        criterion: criterion.label,
        detail: `${criterion.label}: ${formatMetric(target)}`,
        provisional: false,
      };
    }
    return restart(remaining);
  }

  const winner = [...teams].sort()[0];
  const decision = {
    winner,
    criterion: "Projected statistical tiebreak unavailable",
    detail: fallbackLabel,
    provisional: true,
  };
  ctx.provisionalTies.push(decision);
  return decision;
}

function headToHeadPct(ctx: EngineContext, team: string, tiedTeams: string[]) {
  return subsetRecord(ctx, team, (_game, opponent) => tiedTeams.includes(opponent)).pct;
}

function commonGamesPct(
  ctx: EngineContext,
  team: string,
  tiedTeams: string[],
  minimum: number,
) {
  const common = commonOpponents(ctx, tiedTeams);
  const result = subsetRecord(ctx, team, (_game, opponent) => common.has(opponent));
  return result.games >= minimum ? result.pct : null;
}

function breakDivisionTie(teams: string[], ctx: EngineContext): TieDecision {
  if (teams.length === 1) {
    return { winner: teams[0], criterion: "Record", detail: "Best record", provisional: false };
  }
  const twoClub = teams.length === 2;
  const criteria: Criterion[] = [
    {
      label: "Head-to-head",
      value: (team) => headToHeadPct(ctx, team, teams),
    },
    {
      label: "Division record",
      value: (team) => recordPct(ctx.standings[team].division),
    },
    {
      label: "Common games",
      value: (team) => commonGamesPct(ctx, team, teams, 0),
    },
    {
      label: "Conference record",
      value: (team) => recordPct(ctx.standings[team].conference),
    },
    { label: "Strength of victory", value: (team) => strengthOfVictory(ctx, team) },
    { label: "Strength of schedule", value: (team) => strengthOfSchedule(ctx, team) },
    {
      label: "Combined conference points rank",
      value: (team) => combinedPointsRank(ctx, team, true),
      lowerWins: true,
    },
    {
      label: "Combined league points rank",
      value: (team) => combinedPointsRank(ctx, team, false),
      lowerWins: true,
    },
    {
      label: "Net points in common games",
      value: (team) => {
        const common = commonOpponents(ctx, teams);
        return netPoints(ctx, team, (_game, opponent) => common.has(opponent));
      },
    },
    {
      label: "Net points in all games",
      value: (team) => netPoints(ctx, team, () => true),
    },
  ];
  return applyCriteria(
    teams,
    criteria,
    (remaining) => breakDivisionTie(remaining, ctx),
    `The official ${twoClub ? "two-club" : "multi-club"} division procedure next requires projected scoring and touchdown totals, which winner-only picks do not provide. ${[...teams].sort()[0]} is shown first only as a stable display order.`,
    ctx,
  );
}

function headToHeadSweep(ctx: EngineContext, teams: string[]) {
  for (const team of teams) {
    const result = subsetRecord(ctx, team, (_game, opponent) => teams.includes(opponent));
    const opponentsPlayed = new Set(
      gamesForTeam(ctx, team)
        .map((game) => opponentOf(game, team))
        .filter((opponent) => teams.includes(opponent)),
    );
    if (opponentsPlayed.size !== teams.length - 1) continue;
    if (result.record.losses === 0 && result.record.ties === 0) {
      return { winner: team, loser: null };
    }
    if (result.record.wins === 0 && result.record.ties === 0) {
      return { winner: null, loser: team };
    }
  }
  return null;
}

function breakCrossDivisionTie(teams: string[], ctx: EngineContext): TieDecision {
  if (teams.length === 1) {
    return { winner: teams[0], criterion: "Record", detail: "Best record", provisional: false };
  }
  if (teams.length === 2) {
    const criteria: Criterion[] = [
      { label: "Head-to-head", value: (team) => headToHeadPct(ctx, team, teams) },
      {
        label: "Conference record",
        value: (team) => recordPct(ctx.standings[team].conference),
      },
      {
        label: "Common games",
        value: (team) => commonGamesPct(ctx, team, teams, 4),
      },
      { label: "Strength of victory", value: (team) => strengthOfVictory(ctx, team) },
      { label: "Strength of schedule", value: (team) => strengthOfSchedule(ctx, team) },
      {
        label: "Combined conference points rank",
        value: (team) => combinedPointsRank(ctx, team, true),
        lowerWins: true,
      },
      {
        label: "Combined league points rank",
        value: (team) => combinedPointsRank(ctx, team, false),
        lowerWins: true,
      },
      {
        label: "Net points in conference games",
        value: (team) =>
          netPoints(
            ctx,
            team,
            (_game, opponent) =>
              TEAM_BY_ABBR[opponent].conference === TEAM_BY_ABBR[team].conference,
          ),
      },
      {
        label: "Net points in all games",
        value: (team) => netPoints(ctx, team, () => true),
      },
    ];
    return applyCriteria(
      teams,
      criteria,
      (remaining) => breakCrossDivisionTie(remaining, ctx),
      `The official two-club conference procedure next requires projected scoring and touchdown totals, which winner-only picks do not provide. ${[...teams].sort()[0]} is shown first only as a stable display order.`,
      ctx,
    );
  }

  const sweep = headToHeadSweep(ctx, teams);
  if (sweep?.winner) {
    return {
      winner: sweep.winner,
      criterion: "Head-to-head sweep",
      detail: "Defeated every other tied club",
      provisional: false,
    };
  }
  if (sweep?.loser) {
    return breakCrossDivisionTie(
      teams.filter((team) => team !== sweep.loser),
      ctx,
    );
  }

  const criteria: Criterion[] = [
    {
      label: "Conference record",
      value: (team) => recordPct(ctx.standings[team].conference),
    },
    {
      label: "Common games",
      value: (team) => commonGamesPct(ctx, team, teams, 4),
    },
    { label: "Strength of victory", value: (team) => strengthOfVictory(ctx, team) },
    { label: "Strength of schedule", value: (team) => strengthOfSchedule(ctx, team) },
    {
      label: "Combined conference points rank",
      value: (team) => combinedPointsRank(ctx, team, true),
      lowerWins: true,
    },
    {
      label: "Combined league points rank",
      value: (team) => combinedPointsRank(ctx, team, false),
      lowerWins: true,
    },
    {
      label: "Net points in conference games",
      value: (team) =>
        netPoints(
          ctx,
          team,
          (_game, opponent) =>
            TEAM_BY_ABBR[opponent].conference === TEAM_BY_ABBR[team].conference,
        ),
    },
    {
      label: "Net points in all games",
      value: (team) => netPoints(ctx, team, () => true),
    },
  ];
  return applyCriteria(
    teams,
    criteria,
    (remaining) => breakCrossDivisionTie(remaining, ctx),
    `The official multi-club conference procedure next requires projected scoring and touchdown totals, which winner-only picks do not provide. ${[...teams].sort()[0]} is shown first only as a stable display order.`,
    ctx,
  );
}

function bestRecordGroup(teams: string[], ctx: EngineContext) {
  const best = Math.max(...teams.map((team) => ctx.standings[team].winPct));
  return teams.filter((team) => Math.abs(ctx.standings[team].winPct - best) < EPSILON);
}

function rankDivision(teams: string[], ctx: EngineContext) {
  const remaining = [...teams];
  const ranked: string[] = [];
  const decisions: Record<string, TieDecision> = {};
  while (remaining.length) {
    const tied = bestRecordGroup(remaining, ctx);
    const decision = breakDivisionTie(tied, ctx);
    ranked.push(decision.winner);
    decisions[decision.winner] = decision;
    remaining.splice(remaining.indexOf(decision.winner), 1);
  }
  return { ranked, decisions };
}

function reduceToOnePerDivision(teams: string[], ctx: EngineContext) {
  const groups = new Map<Division, string[]>();
  for (const team of teams) {
    const division = TEAM_BY_ABBR[team].division;
    groups.set(division, [...(groups.get(division) ?? []), team]);
  }
  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => ctx.divisionOrder[a] - ctx.divisionOrder[b])[0],
  );
}

function breakWildCardTie(teams: string[], ctx: EngineContext) {
  if (teams.length === 1) {
    return {
      winner: teams[0],
      criterion: "Record",
      detail: "Best won-lost-tied percentage",
      provisional: false,
    } satisfies TieDecision;
  }
  const reduced = reduceToOnePerDivision(teams, ctx);
  if (reduced.length === 1) {
    return {
      winner: reduced[0],
      criterion: "Division tiebreaker",
      detail: "Highest-ranked tied club from its division",
      provisional: false,
    } satisfies TieDecision;
  }
  return breakCrossDivisionTie(reduced, ctx);
}

function selectBestConferenceTeam(teams: string[], ctx: EngineContext) {
  const tied = bestRecordGroup(teams, ctx);
  return breakWildCardTie(tied, ctx);
}

function conferenceProjection(conference: Conference, ctx: EngineContext): ConferenceProjection {
  const conferenceDivisions = DIVISIONS.filter((division) => division.startsWith(conference));
  const divisions: Record<string, TeamStanding[]> = {};
  const divisionWinners: string[] = [];
  const divisionDecisions: Record<string, TieDecision> = {};

  for (const division of conferenceDivisions) {
    const teams = TEAMS.filter((entry) => entry.division === division).map(
      (entry) => entry.abbreviation,
    );
    const { ranked, decisions } = rankDivision(teams, ctx);
    ranked.forEach((team, index) => {
      ctx.divisionOrder[team] = index;
    });
    divisions[division] = ranked.map((team) => ctx.standings[team]);
    divisionWinners.push(ranked[0]);
    divisionDecisions[ranked[0]] = decisions[ranked[0]];
  }

  const seededDivisionWinners: { team: string; decision: TieDecision }[] = [];
  const remainingWinners = [...divisionWinners];
  while (remainingWinners.length) {
    const decision = selectBestConferenceTeam(remainingWinners, ctx);
    seededDivisionWinners.push({ team: decision.winner, decision });
    remainingWinners.splice(remainingWinners.indexOf(decision.winner), 1);
  }

  const nonChampions = TEAMS.filter(
    (entry) =>
      entry.conference === conference && !divisionWinners.includes(entry.abbreviation),
  ).map((entry) => entry.abbreviation);
  const wildCards: { team: string; decision: TieDecision }[] = [];
  while (wildCards.length < 3) {
    const decision = selectBestConferenceTeam(nonChampions, ctx);
    wildCards.push({ team: decision.winner, decision });
    nonChampions.splice(nonChampions.indexOf(decision.winner), 1);
  }

  const seeds: PlayoffSeed[] = [
    ...seededDivisionWinners.map(({ team, decision }, index) => ({
      seed: index + 1,
      team,
      berth: "Division" as const,
      standing: ctx.standings[team],
      tiebreaker:
        decision.criterion === "Record" ? divisionDecisions[team] : decision,
    })),
    ...wildCards.map(({ team, decision }, index) => ({
      seed: index + 5,
      team,
      berth: "Wild card" as const,
      standing: ctx.standings[team],
      tiebreaker: decision,
    })),
  ];

  return { conference, seeds, divisions };
}

export function projectPlayoffs(
  picks: ProjectionPicks,
  games: Game[] = ALL_GAMES,
): PlayoffProjection {
  const resolvedGames = resolveGames(games, picks);
  const standings = buildStandings(resolvedGames);
  const ctx: EngineContext = {
    games,
    resolvedGames,
    standings,
    opponents: buildOpponents(games),
    divisionOrder: {},
    provisionalTies: [],
  };
  const conferences = {
    AFC: conferenceProjection("AFC", ctx),
    NFC: conferenceProjection("NFC", ctx),
  };
  const completedSelections = resolvedGames.filter(
    (game) => game.resolvedWinner || game.resolvedTie,
  ).length;
  return {
    conferences,
    completedSelections,
    totalGames: games.length,
    unresolvedGames: games.length - completedSelections,
    provisionalTies: ctx.provisionalTies,
  };
}
