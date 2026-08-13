import assert from "node:assert/strict";
import test from "node:test";
import { localDay, reminderKindForDay, utcForLocal } from "./reminderSchedule";

test("reminder schedule respects Pacific daylight time", () => {
  const now = new Date("2026-09-10T12:00:00Z"); const day = localDay(now, "America/Los_Angeles");
  assert.equal(reminderKindForDay(day), "thursday"); assert.equal(utcForLocal(day, 9, "America/Los_Angeles").toISOString(), "2026-09-10T16:00:00.000Z");
});

test("Sunday is detected independently in Eastern time", () => {
  const day = localDay(new Date("2026-09-13T15:00:00Z"), "America/New_York"); assert.equal(reminderKindForDay(day), "sunday");
});
