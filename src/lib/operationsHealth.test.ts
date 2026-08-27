import assert from "node:assert/strict";
import test from "node:test";

import { finalResultHealth, gameDayHealth, scheduleHealth, snapshotHealth, type OperationsGame } from "./operationsHealth";

const game = (overrides: Partial<OperationsGame> = {}): OperationsGame => ({
  id: "game-1", week: 1, kickoff_at: "2026-09-10T00:00:00Z", status: "scheduled",
  away_score: null, home_score: null, winner_team_id: null, ...overrides,
});

test("schedule readiness requires the full NFL week pattern", () => {
  const counts = [16, 16, 16, 16, 15, 14, 14, 14, 15, 14, 13, 16, 14, 15, 16, 16, 16, 16];
  const games = counts.flatMap((count, index) => Array.from({ length: count }, (_, item) => game({ id: `${index + 1}-${item}`, week: index + 1 })));
  assert.deepEqual(scheduleHealth(games), { games: 272, weeks: 18, complete: true });
});

test("snapshot readiness flags an upcoming unlocked game", () => {
  const now = new Date("2026-09-09T00:00:00Z");
  assert.deepEqual(snapshotHealth([game()], [], now), { captured: 0, due: 1, missingDue: 1, late: 0, ready: false });
  assert.equal(snapshotHealth([game()], [{ game_id: "game-1", capture_is_pregame: true }], now).ready, true);
});

test("final result readiness requires scores and a winner for non-ties", () => {
  assert.deepEqual(finalResultHealth([game({ status: "final", away_score: 17, home_score: 20 })]), { finals: 1, incomplete: 1, ready: false });
  assert.equal(finalResultHealth([game({ status: "final", away_score: 17, home_score: 20, winner_team_id: "home" })]).ready, true);
});

test("game-day health tracks monitored games and sync freshness", () => {
  const now = new Date("2026-09-10T01:00:00Z");
  const health = gameDayHealth(
    [game({ kickoff_at: "2026-09-10T00:00:00Z" })],
    [{ status: "success", finished_at: "2026-09-10T00:45:00Z" }],
    now
  );
  assert.deepEqual(health.monitoredGameIds, ["game-1"]);
  assert.equal(health.syncFresh, true);
  assert.equal(health.ready, true);
});

test("game-day health flags stale results and recent failures", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const health = gameDayHealth(
    [game({ kickoff_at: "2026-09-11T00:00:00Z", status: "scheduled" })],
    [{ status: "error", finished_at: "2026-09-11T11:30:00Z" }],
    now
  );
  assert.deepEqual(health.attentionGameIds, ["game-1"]);
  assert.equal(health.recentFailures, 1);
  assert.equal(health.ready, false);
});
