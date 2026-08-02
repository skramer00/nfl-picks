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
