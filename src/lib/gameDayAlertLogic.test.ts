import assert from "node:assert/strict";
import test from "node:test";

import { gameDayIncidentKey } from "./gameDayAlertLogic";

test("game-day incident keys are stable regardless of subject order", () => {
  const now = new Date("2026-09-10T12:30:00Z");
  const first = gameDayIncidentKey({ type: "result_attention", season: 2026, subjects: ["game-b", "game-a"], now });
  const second = gameDayIncidentKey({ type: "result_attention", season: 2026, subjects: ["game-a", "game-b"], now });
  assert.equal(first, second);
});

test("sync failure alerts deduplicate within a six-hour window", () => {
  const first = gameDayIncidentKey({ type: "sync_error", season: 2026, subjects: ["week-1"], now: new Date("2026-09-10T12:01:00Z") });
  const second = gameDayIncidentKey({ type: "sync_error", season: 2026, subjects: ["week-1"], now: new Date("2026-09-10T17:59:00Z") });
  const later = gameDayIncidentKey({ type: "sync_error", season: 2026, subjects: ["week-1"], now: new Date("2026-09-10T18:01:00Z") });
  assert.equal(first, second);
  assert.notEqual(first, later);
});
