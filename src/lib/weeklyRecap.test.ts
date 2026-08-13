import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyRecap } from "./weeklyRecap";
import type { GameRow } from "./gamesDb";

const team = (id: string, name: string) => ({ id, name, abbreviation: id.toUpperCase(), conference: "AFC", division: "East" });
const game = (id: string, homeProb: number, winner: string): GameRow => ({ id, season: 2026, week: 1, kickoff_iso: "2026-09-10T00:00:00Z", away_team_id: `${id}a`, home_team_id: `${id}h`, away_score: 20, home_score: 24, status: "final", winner_team_id: winner, home_win_prob: homeProb, away_win_prob: 1 - homeProb, favorability_override_reason: null, rest_advantage_team_id: null, rest_advantage_days: null, rest_adjustment: 0, playoff_round: null, updated_at: "", prediction_captured_at: "", prediction_model_version: "test", prediction_snapshot_is_pregame: true, away_team: team(`${id}a`, `${id} Away`), home_team: team(`${id}h`, `${id} Home`) });

test("weekly recap scores picks and identifies an upset and miss", () => {
  const upset = game("one", 0.7, "onea");
  const miss = game("two", 0.65, "twoa");
  const recap = buildWeeklyRecap([upset, miss], { one: "onea", two: "twoh" }, 1);
  assert.equal(recap.correct, 1); assert.equal(recap.points, 3); assert.equal(recap.accuracy, 50); assert.equal(recap.agreement, 50);
  assert.equal(recap.bestUpset?.team, "one Away"); assert.equal(recap.biggestMiss?.winner, "two Away");
});

test("weekly recap stays unavailable before final results", () => {
  const scheduled = { ...game("one", 0.6, "oneh"), status: "scheduled", winner_team_id: null };
  const recap = buildWeeklyRecap([scheduled], { one: "oneh" }, 1);
  assert.equal(recap.finalPicks, 0); assert.equal(recap.accuracy, null); assert.equal(recap.pending, 1);
});
