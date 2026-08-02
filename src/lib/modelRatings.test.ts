import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_RATINGS,
  MODEL_VERSION,
  modelRatingAudit,
  preseasonTeamStrength,
} from "./modelRatings";

test("Model v2 contains one auditable rating for every NFL team", () => {
  assert.equal(MODEL_VERSION, "2026.2");
  assert.equal(MODEL_RATINGS.length, 32);
  assert.equal(new Set(MODEL_RATINGS.map((team) => team.abbreviation)).size, 32);
});

test("every rating equals its published components", () => {
  for (const team of MODEL_RATINGS) {
    assert.equal(
      team.rating,
      1500 + team.performanceElo + team.quarterbackAdjustment + team.continuityAdjustment,
      team.abbreviation,
    );
  }
});

test("Washington aliases resolve to the same explicit rating", () => {
  assert.equal(preseasonTeamStrength("WAS"), preseasonTeamStrength("WSH"));
  assert.equal(modelRatingAudit("WSH")?.abbreviation, "WSH");
});

test("Chargers rating is generated rather than falling back to neutral", () => {
  const chargers = modelRatingAudit("LAC");
  assert.ok(chargers);
  assert.notEqual(chargers.rating, 1500);
  assert.equal(preseasonTeamStrength("LAC"), chargers.rating);
});
