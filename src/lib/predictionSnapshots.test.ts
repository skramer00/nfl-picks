import assert from "node:assert/strict";
import test from "node:test";

import { MATCHUP_MODEL_VERSION } from "./favorability";
import { predictionSnapshotForGame, type SnapshotGame } from "./predictionSnapshots";

const game: SnapshotGame = {
  id: "game-1",
  season: 2026,
  week: 3,
  kickoff_at: "2026-09-20T20:00:00Z",
  away_team_id: "away",
  home_team_id: "home",
  away_team: { id: "away", abbreviation: "NYG", conference: "NFC", division: "East" },
  home_team: { id: "home", abbreviation: "DAL", conference: "NFC", division: "East" },
};

test("prediction snapshot records model inputs and pregame status", () => {
  const snapshot = predictionSnapshotForGame({
    game,
    rest: { awayRestDays: 6, homeRestDays: 8, homeAdvantageDays: 2 },
    source: "cron",
    now: new Date("2026-09-20T12:00:00Z"),
  });

  assert.equal(snapshot.model_version, MATCHUP_MODEL_VERSION);
  assert.equal(snapshot.capture_is_pregame, true);
  assert.equal(snapshot.is_division_matchup, true);
  assert.equal(snapshot.division_cap, 0.7);
  assert.equal(snapshot.rest_advantage_team_id, "home");
  assert.equal(snapshot.rest_advantage_days, 2);
  assert.equal(Number(snapshot.away_win_probability) + Number(snapshot.home_win_probability), 1);
});

test("manual override is preserved without applying rest twice", () => {
  const snapshot = predictionSnapshotForGame({
    game,
    override: { game_id: game.id, home_win_probability: 0.61, reason: "Late injury update" },
    rest: { awayRestDays: 6, homeRestDays: 8, homeAdvantageDays: 2 },
    source: "manual",
    now: new Date("2026-09-20T21:00:00Z"),
  });

  assert.equal(snapshot.capture_is_pregame, false);
  assert.equal(snapshot.home_win_probability, 0.61);
  assert.equal(snapshot.away_win_probability, 0.39);
  assert.equal(snapshot.manual_override, true);
  assert.equal(snapshot.manual_override_reason, "Late injury update");
  assert.equal(snapshot.rest_adjustment, 0);
  assert.equal(snapshot.rest_advantage_team_id, null);
});

test("early and final forecasts are independent, immutable, paired and never backfilled after kickoff", async () => {
  const { capturePredictionSnapshots } = await import("./predictionSnapshots");
  const archives: Record<string, unknown>[] = [];
  const forecasts: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      const data = table === "games" ? [game] : table === "model_prediction_snapshots" ? archives : [];
      const query = {
        select() { return query; }, eq() { return query; }, in() { return query; }, order() { return query; },
        then(resolve: (result: { data: unknown[]; error: null }) => unknown) { return Promise.resolve(resolve({ data, error: null })); },
        async upsert(rows: Record<string, unknown>[], options: { ignoreDuplicates: boolean }) {
          assert.equal(options.ignoreDuplicates, true);
          const target = table === "model_prediction_snapshots" ? archives : forecasts;
          for (const row of rows) if (!target.some((old) => old.game_id === row.game_id && (target === archives || old.model_version === row.model_version && old.forecast_kind === row.forecast_kind))) target.push(row);
          return { error: null };
        },
      };
      return query;
    },
  } as unknown as Parameters<typeof capturePredictionSnapshots>[0]["supabase"];
  const capture = (time: string) => capturePredictionSnapshots({ supabase: client, season: 2026, weeks: [3], source: "cron", now: new Date(time) });
  await capture("2026-09-20T00:00:00Z");
  assert.equal(archives.length, 1);
  assert.equal(forecasts.length, 2);
  const original = JSON.stringify(archives);
  await capture("2026-09-20T19:15:00Z");
  assert.equal(forecasts.length, 4);
  const final = forecasts.filter((row) => row.forecast_kind === "final");
  assert.equal(final[0].captured_at, final[1].captured_at);
  assert.equal(final[0].model_version, "2026.5");
  assert.equal(final[1].model_version, "2026.4-baseline");
  await capture("2026-09-20T19:45:00Z");
  await capture("2026-09-20T20:01:00Z");
  assert.equal(forecasts.length, 4);
  assert.equal(JSON.stringify(archives), original);
});

test("capture saves a separate trial and observed market without overriding the production forecast", async () => {
  const { capturePredictionSnapshots } = await import("./predictionSnapshots");
  const writes = new Map<string, Record<string, unknown>[]>();
  const client = { from(table: string) {
    const query = { select() { return query; }, eq() { return query; }, in() { return query; }, order() { return query; },
      then(resolve: (r: unknown) => unknown) { return Promise.resolve(resolve({ data: table === "games" ? [game] : [], error: null })); },
      async upsert(rows: Record<string, unknown>[]) { writes.set(table, rows); return { error: null }; } };
    return query;
  } } as unknown as Parameters<typeof capturePredictionSnapshots>[0]["supabase"];
  const efficiency = ["DAL", "NYG"].flatMap((team) => [1, 2].map((week) => ({ game_id: `past-${week}`, team, opponent: team === "DAL" ? "NYG" : "DAL", week, season: 2026, kickoff_at: "2026-09-10T00:00:00Z", observed_at: "2026-09-12T00:00:00Z", plays: 60, epa: team === "DAL" ? -10 : 10, successes: 30, pass_plays: 40, pass_epa: 0, rush_plays: 20, rush_epa: 0, content_hash: team, source: "test" })));
  await capturePredictionSnapshots({ supabase: client, season: 2026, weeks: [3], source: "cron", now: new Date("2026-09-20T19:15:00Z"), efficiency,
    markets: new Map([[game.id, { provider: "DraftKings", observed_at: "2026-09-20T19:14:00Z", provider_event_id: "123", source: "test", home_moneyline: -155, away_moneyline: 130, home_probability: .583 }]]) });
  const forecasts = writes.get("model_forecasts")!;
  assert.equal(forecasts.length, 3);
  const prod = forecasts.find((r) => r.model_version === "2026.5")!;
  const trial = forecasts.find((r) => r.model_version === "2026.6-efficiency-shadow")!;
  const original = predictionSnapshotForGame({ game, source: "cron", now: new Date("2026-09-20T19:15:00Z") });
  assert.equal(prod.home_win_probability, original.home_win_probability);
  assert.notEqual(trial.home_win_probability, prod.home_win_probability);
  assert.equal(trial.captured_at, prod.captured_at);
  assert.equal(writes.get("model_market_snapshots")!.length, 1);
});
