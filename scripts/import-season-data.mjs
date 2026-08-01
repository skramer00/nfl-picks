import { mkdir, writeFile } from "node:fs/promises";

const SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

async function loadCalendarYear(year) {
  const response = await fetch(
    `${SCOREBOARD}?limit=1000&dates=${year}&seasontype=2`,
  );
  if (!response.ok) {
    throw new Error(`ESPN schedule request failed (${response.status})`);
  }
  return response.json();
}

function seasonEvents(documents, season) {
  const byId = new Map();
  for (const event of documents.flatMap((document) => document.events ?? [])) {
    if (event.season?.year === season && event.season?.type === 2) {
      byId.set(event.id, event);
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      (a.week?.number ?? 0) - (b.week?.number ?? 0) ||
      new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

function competitor(event, homeAway) {
  return event.competitions[0].competitors.find(
    (entry) => entry.homeAway === homeAway,
  );
}

function normalizedGame(event) {
  const home = competitor(event, "home");
  const away = competitor(event, "away");
  const completed = event.status?.type?.completed === true;
  const homeScore = completed ? Number(home.score) : null;
  const awayScore = completed ? Number(away.score) : null;
  const tie = completed && homeScore === awayScore;

  return {
    id: event.id,
    week: event.week.number,
    kickoffISO: event.date,
    awayTeam: away.team.abbreviation,
    homeTeam: home.team.abbreviation,
    status: completed ? "final" : "scheduled",
    winner: tie ? null : home.winner ? home.team.abbreviation : away.winner ? away.team.abbreviation : null,
    isTie: tie,
    awayScore,
    homeScore,
  };
}

function priorSeasonRatings(events) {
  const records = new Map();
  const get = (team) => {
    if (!records.has(team)) {
      records.set(team, { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    return records.get(team);
  };

  for (const event of events) {
    const game = normalizedGame(event);
    if (game.status !== "final") continue;
    const away = get(game.awayTeam);
    const home = get(game.homeTeam);
    away.pointsFor += game.awayScore;
    away.pointsAgainst += game.homeScore;
    home.pointsFor += game.homeScore;
    home.pointsAgainst += game.awayScore;
    if (game.isTie) {
      away.ties += 1;
      home.ties += 1;
    } else if (game.winner === game.awayTeam) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.wins += 1;
      away.losses += 1;
    }
  }

  return Object.fromEntries(
    [...records.entries()].map(([team, record]) => {
      const games = record.wins + record.losses + record.ties;
      const winPct = (record.wins + record.ties / 2) / games;
      const pfExponent = Math.pow(record.pointsFor, 2.37);
      const paExponent = Math.pow(record.pointsAgainst, 2.37);
      const pythagoreanPct = pfExponent / (pfExponent + paExponent);
      return [team, Number((winPct * 0.65 + pythagoreanPct * 0.35).toFixed(5))];
    }),
  );
}

function modelPicks(games, ratings) {
  const HOME_FIELD_EDGE = 0.035;
  return Object.fromEntries(
    games.map((game) => {
      const awayRating = ratings[game.awayTeam] ?? 0.5;
      const homeRating = (ratings[game.homeTeam] ?? 0.5) + HOME_FIELD_EDGE;
      return [game.id, homeRating >= awayRating ? game.homeTeam : game.awayTeam];
    }),
  );
}

const [calendar2025, calendar2026, calendar2027] = await Promise.all([
  loadCalendarYear(2025),
  loadCalendarYear(2026),
  loadCalendarYear(2027),
]);

const season2025 = seasonEvents([calendar2025, calendar2026], 2025);
const season2026 = seasonEvents([calendar2026, calendar2027], 2026);
const games = season2026.map(normalizedGame);

if (games.length !== 272) {
  throw new Error(`Expected 272 regular-season games, received ${games.length}`);
}

const ratings = priorSeasonRatings(season2025);
const model = {
  id: "prior-season-baseline-v1",
  label: "Baseline model",
  generatedAt: new Date().toISOString(),
  methodology:
    "65% prior-season win percentage and 35% Pythagorean win percentage, with a 0.035 home-field rating adjustment.",
  sourceSeason: 2025,
  picks: modelPicks(games, ratings),
};

await mkdir("src/data", { recursive: true });
await Promise.all([
  writeFile("src/data/games_2026.json", `${JSON.stringify(games, null, 2)}\n`),
  writeFile("src/data/model_picks_2026.json", `${JSON.stringify(model, null, 2)}\n`),
]);

console.log(`Imported ${games.length} games and ${Object.keys(model.picks).length} model picks.`);
