import { mkdir, writeFile } from "node:fs/promises";

const SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const TEAM_API =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const PLAYER_STATS =
  "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes";

const SOURCE_SEASON = 2025;
const TARGET_SEASON = 2026;
const OFFSEASON_RETENTION = 0.7;
const ELO_PER_POINT = 20;
const QBR_ELO_PER_POINT = 1.5;
const MAX_QB_ADJUSTMENT = 30;
const FULL_QB_SAMPLE_ATTEMPTS = 400;
const CONTINUITY_ADJUSTMENT = 8;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function normalizedTeam(team) {
  return team === "WAS" ? "WSH" : team;
}

function competitor(event, homeAway) {
  return event.competitions[0].competitors.find(
    (entry) => entry.homeAway === homeAway,
  );
}

async function completedRegularSeason() {
  const documents = await Promise.all(
    [SOURCE_SEASON, SOURCE_SEASON + 1].map((year) =>
      json(`${SCOREBOARD}?limit=1000&dates=${year}&seasontype=2`),
    ),
  );
  return [
    ...new Map(
      documents
        .flatMap((document) => document.events ?? [])
        .filter(
          (event) =>
            event.season?.year === SOURCE_SEASON &&
            event.season?.type === 2 &&
            event.status?.type?.completed === true,
        )
        .map((event) => [event.id, event]),
    ).values(),
  ];
}

function gameRows(events) {
  return events.map((event) => {
    const home = competitor(event, "home");
    const away = competitor(event, "away");
    return {
      home: normalizedTeam(home.team.abbreviation),
      away: normalizedTeam(away.team.abbreviation),
      homeTeamId: home.team.id,
      awayTeamId: away.team.id,
      homePoints: Number(home.score),
      awayPoints: Number(away.score),
    };
  });
}

function seasonSummary(games) {
  const summaries = new Map();
  const get = (team, teamId) => {
    if (!summaries.has(team)) {
      summaries.set(team, {
        team,
        teamId,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
    return summaries.get(team);
  };

  for (const game of games) {
    const home = get(game.home, game.homeTeamId);
    const away = get(game.away, game.awayTeamId);
    home.pointsFor += game.homePoints;
    home.pointsAgainst += game.awayPoints;
    away.pointsFor += game.awayPoints;
    away.pointsAgainst += game.homePoints;
    if (game.homePoints === game.awayPoints) {
      home.ties += 1;
      away.ties += 1;
    } else if (game.homePoints > game.awayPoints) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }
  return summaries;
}

function opponentAdjustedComponents(games, teams) {
  const leaguePoints =
    games.reduce((total, game) => total + game.homePoints + game.awayPoints, 0) /
    (games.length * 2);
  let offense = Object.fromEntries([...teams.keys()].map((team) => [team, 0]));
  let defense = { ...offense };

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const samples = Object.fromEntries(
      [...teams.keys()].map((team) => [team, { offense: [], defense: [] }]),
    );
    for (const game of games) {
      samples[game.home].offense.push(
        game.homePoints - leaguePoints + defense[game.away],
      );
      samples[game.home].defense.push(
        offense[game.away] - (game.awayPoints - leaguePoints),
      );
      samples[game.away].offense.push(
        game.awayPoints - leaguePoints + defense[game.home],
      );
      samples[game.away].defense.push(
        offense[game.home] - (game.homePoints - leaguePoints),
      );
    }
    const nextOffense = {};
    const nextDefense = {};
    for (const [team, values] of Object.entries(samples)) {
      nextOffense[team] =
        values.offense.reduce((sum, value) => sum + value, 0) /
        values.offense.length;
      nextDefense[team] =
        values.defense.reduce((sum, value) => sum + value, 0) /
        values.defense.length;
    }
    const offenseMean =
      Object.values(nextOffense).reduce((sum, value) => sum + value, 0) /
      Object.keys(nextOffense).length;
    const defenseMean =
      Object.values(nextDefense).reduce((sum, value) => sum + value, 0) /
      Object.keys(nextDefense).length;
    offense = Object.fromEntries(
      Object.entries(nextOffense).map(([team, value]) => [team, value - offenseMean]),
    );
    defense = Object.fromEntries(
      Object.entries(nextDefense).map(([team, value]) => [team, value - defenseMean]),
    );
  }
  return { leaguePoints, offense, defense };
}

async function startingQuarterback(team) {
  const depthChart = await json(`${TEAM_API}/${team.toLowerCase()}/depthcharts`);
  for (const formation of depthChart.depthchart ?? []) {
    for (const entry of Object.values(formation.positions ?? {})) {
      if (entry.position?.abbreviation === "QB" && entry.athletes?.[0]) {
        return entry.athletes[0];
      }
    }
  }
  return null;
}

async function quarterbackSeason(quarterback) {
  if (!quarterback) return null;
  const document = await json(
    `${PLAYER_STATS}/${quarterback.id}/stats?region=us&lang=en&season=${SOURCE_SEASON}&seasontype=2`,
  );
  const passing = document.categories?.find((category) => category.name === "passing");
  const season = passing?.statistics?.find(
    (entry) => entry.season?.year === SOURCE_SEASON,
  );
  if (!passing || !season) return null;
  const values = Object.fromEntries(
    passing.names.map((name, index) => [name, season.stats[index]]),
  );
  return {
    teamId: season.teamId,
    attempts: Number(String(values.passingAttempts ?? 0).replaceAll(",", "")),
    adjustedQbr: Number(values.adjQBR),
  };
}

const events = await completedRegularSeason();
const games = gameRows(events);
if (games.length !== 272) {
  throw new Error(`Expected 272 ${SOURCE_SEASON} games, received ${games.length}`);
}
const summaries = seasonSummary(games);
const components = opponentAdjustedComponents(games, summaries);

const quarterbackInputs = await Promise.all(
  [...summaries.keys()].sort().map(async (team) => {
    const starter = await startingQuarterback(team);
    const season = await quarterbackSeason(starter);
    return [team, { starter, season }];
  }),
);
const quarterbacks = Object.fromEntries(quarterbackInputs);

const teams = [...summaries.values()]
  .map((summary) => {
    const quarterback = quarterbacks[summary.team];
    const adjustedQbr = Number.isFinite(quarterback.season?.adjustedQbr)
      ? quarterback.season.adjustedQbr
      : null;
    const quarterbackSampleWeight = Math.min(
      (quarterback.season?.attempts ?? 0) / FULL_QB_SAMPLE_ATTEMPTS,
      1,
    );
    const quarterbackAdjustment =
      adjustedQbr === null
        ? 0
        : clamp(
            (adjustedQbr - 50) * QBR_ELO_PER_POINT,
            -MAX_QB_ADJUSTMENT,
            MAX_QB_ADJUSTMENT,
          ) * quarterbackSampleWeight;
    const establishedStarter = (quarterback.season?.attempts ?? 0) >= 200;
    const sameTeam = quarterback.season?.teamId === summary.teamId;
    const continuityAdjustment = establishedStarter
      ? sameTeam
        ? CONTINUITY_ADJUSTMENT
        : -CONTINUITY_ADJUSTMENT
      : 0;
    const performancePoints =
      components.offense[summary.team] + components.defense[summary.team];
    const regressedPerformancePoints = performancePoints * OFFSEASON_RETENTION;
    const performanceElo = regressedPerformancePoints * ELO_PER_POINT;
    const roundedPerformanceElo = Math.round(performanceElo);
    const roundedQuarterbackAdjustment = Math.round(quarterbackAdjustment);
    const rating =
      1500 +
      roundedPerformanceElo +
      roundedQuarterbackAdjustment +
      continuityAdjustment;
    return {
      abbreviation: summary.team,
      sourceTeamId: summary.teamId,
      record: `${summary.wins}-${summary.losses}${summary.ties ? `-${summary.ties}` : ""}`,
      pointsFor: summary.pointsFor,
      pointsAgainst: summary.pointsAgainst,
      offensePointsAboveAverage: Number(components.offense[summary.team].toFixed(2)),
      defensePointsAboveAverage: Number(components.defense[summary.team].toFixed(2)),
      opponentAdjustedNetPoints: Number(performancePoints.toFixed(2)),
      regressedNetPoints: Number(regressedPerformancePoints.toFixed(2)),
      performanceElo: roundedPerformanceElo,
      quarterback: quarterback.starter?.displayName ?? "Unverified starter",
      quarterback2025Attempts: quarterback.season?.attempts ?? null,
      quarterback2025AdjustedQbr: adjustedQbr,
      quarterbackSampleWeight: Number(quarterbackSampleWeight.toFixed(3)),
      quarterbackAdjustment: roundedQuarterbackAdjustment,
      quarterbackContinuity: establishedStarter
        ? sameTeam
          ? "returning"
          : "new-team"
        : "unproven-or-no-data",
      continuityAdjustment,
      rating,
    };
  })
  .sort((first, second) => second.rating - first.rating);

const output = {
  version: "2026.2",
  generatedAt: new Date().toISOString(),
  sourceSeason: SOURCE_SEASON,
  targetSeason: TARGET_SEASON,
  methodology: {
    description:
      "Pretzel Quest ratings generated from opponent-adjusted scoring, offseason regression, Adjusted QBR, and quarterback continuity.",
    offseasonRetention: OFFSEASON_RETENTION,
    eloPerPoint: ELO_PER_POINT,
    quarterbackEloPerQbrPoint: QBR_ELO_PER_POINT,
    maximumQuarterbackAdjustment: MAX_QB_ADJUSTMENT,
    fullQuarterbackSampleAttempts: FULL_QB_SAMPLE_ATTEMPTS,
    returningStarterAdjustment: CONTINUITY_ADJUSTMENT,
    newTeamStarterAdjustment: -CONTINUITY_ADJUSTMENT,
    neutralRating: 1500,
  },
  sources: [
    `${SCOREBOARD} (2025 regular-season results)`,
    `${TEAM_API}/{team}/depthcharts (2026 projected starter)`,
    `${PLAYER_STATS}/{athlete}/stats (2025 Adjusted QBR)`,
  ],
  leagueAveragePointsPerTeamGame: Number(components.leaguePoints.toFixed(2)),
  teams,
};

await mkdir("src/data", { recursive: true });
await writeFile(
  "src/data/model_ratings_2026.json",
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(`Generated ${teams.length} auditable ratings for Model ${output.version}.`);
