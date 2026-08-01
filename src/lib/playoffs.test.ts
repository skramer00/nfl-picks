import assert from "node:assert/strict";
import test from "node:test";
import modelData from "@/data/model_picks_2026.json";
import { projectPlayoffs } from "@/lib/playoffs";
import { ALL_GAMES, Game, TEAM_BY_ABBR } from "@/lib/season";

test("the imported 2026 schedule is complete", () => {
  assert.equal(ALL_GAMES.length, 272);
  const appearances = new Map<string, number>();
  for (const game of ALL_GAMES) {
    appearances.set(game.awayTeam, (appearances.get(game.awayTeam) ?? 0) + 1);
    appearances.set(game.homeTeam, (appearances.get(game.homeTeam) ?? 0) + 1);
  }
  assert.equal(appearances.size, 32);
  for (const games of appearances.values()) assert.equal(games, 17);
});

test("a complete model card produces seven unique seeds per conference", () => {
  const projection = projectPlayoffs(modelData.picks);
  assert.equal(projection.completedSelections, 272);
  assert.equal(projection.unresolvedGames, 0);

  for (const conference of ["AFC", "NFC"] as const) {
    const seeds = projection.conferences[conference].seeds;
    assert.equal(seeds.length, 7);
    assert.equal(new Set(seeds.map((seed) => seed.team)).size, 7);
    assert.deepEqual(
      seeds.map((seed) => seed.seed),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.equal(seeds.filter((seed) => seed.berth === "Division").length, 4);
    assert.equal(seeds.filter((seed) => seed.berth === "Wild card").length, 3);
  }
});

test("each division winner occupies a top-four conference seed", () => {
  const projection = projectPlayoffs(modelData.picks);
  for (const conference of ["AFC", "NFC"] as const) {
    const result = projection.conferences[conference];
    const seededChampions = new Set(result.seeds.slice(0, 4).map((seed) => seed.team));
    for (const [division, rows] of Object.entries(result.divisions)) {
      assert.equal(TEAM_BY_ABBR[rows[0].team].division, division);
      assert.ok(seededChampions.has(rows[0].team));
    }
  }
});

test("head-to-head result orders tied teams within their division", () => {
  const games: Game[] = [
    game("1", "MIA", "BUF"),
    game("2", "BUF", "MIA"),
    game("3", "BUF", "PIT"),
    game("4", "NE", "BUF"),
    game("5", "MIA", "NYJ"),
    game("6", "JAX", "MIA"),
  ];
  const picks = {
    "1": "BUF",
    "2": "BUF",
    "3": "PIT",
    "4": "NE",
    "5": "MIA",
    "6": "MIA",
  };
  const rows = projectPlayoffs(picks, games).conferences.AFC.divisions["AFC East"];
  assert.equal(rows.find((row) => row.team === "BUF")?.wins, 2);
  assert.equal(rows.find((row) => row.team === "MIA")?.wins, 2);
  assert.ok(
    rows.findIndex((row) => row.team === "BUF") <
      rows.findIndex((row) => row.team === "MIA"),
  );
});

test("unpicked games remain unresolved rather than becoming model wins", () => {
  const projection = projectPlayoffs({ [ALL_GAMES[0].id]: ALL_GAMES[0].homeTeam });
  assert.equal(projection.completedSelections, 1);
  assert.equal(projection.unresolvedGames, 271);
});

function game(id: string, awayTeam: string, homeTeam: string): Game {
  return {
    id,
    week: 1,
    kickoffISO: "2026-09-01T17:00:00Z",
    awayTeam,
    homeTeam,
    status: "scheduled",
    winner: null,
    isTie: false,
    awayScore: null,
    homeScore: null,
  };
}
