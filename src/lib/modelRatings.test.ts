import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_RATINGS,
  MODEL_VERSION,
  matchupTeamStrength,
  modelRatingAudit,
  preseasonTeamStrength,
} from "./modelRatings";

test("Model v2 contains one auditable rating for every NFL team", () => {
  assert.equal(MODEL_VERSION, "2026.4");
  assert.equal(MODEL_RATINGS.length, 32);
  assert.equal(new Set(MODEL_RATINGS.map((team) => team.abbreviation)).size, 32);
});

test("every rating equals its published components", () => {
  for (const team of MODEL_RATINGS) {
    assert.equal(
      team.baseRating,
      1500 + team.performanceElo + team.playEfficiencyElo + team.outcomeElo + team.quarterbackAdjustment + team.continuityAdjustment,
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

test("same-season result quality distinguishes Chargers and Chiefs without an override", () => {
  const chargers = modelRatingAudit("LAC");
  const chiefs = modelRatingAudit("KC");
  assert.ok(chargers && chiefs);
  assert.ok(chargers.outcomeElo > chiefs.outcomeElo);
  assert.ok(chargers.rating > chiefs.rating);
});

test("weekly quarterback availability blends starter and backup value", () => {
  assert.ok(matchupTeamStrength("KC", 1) < preseasonTeamStrength("KC"));
  assert.equal(matchupTeamStrength("KC", 5), preseasonTeamStrength("KC"));
  assert.equal(matchupTeamStrength("LAC", 1), preseasonTeamStrength("LAC"));
});

test("offseason ledger applies net, bounded adjustments without changing base arithmetic", () => {
  const rams = modelRatingAudit("LAR");
  const chiefs = modelRatingAudit("KC");
  const chargers = modelRatingAudit("LAC");
  assert.ok(rams && chiefs && chargers);
  assert.equal(rams.offseasonAdjustment, 23);
  assert.equal(chiefs.offseasonAdjustment, -11);
  assert.equal(chargers.offseasonAdjustment, 5);
  assert.equal(rams.rating, rams.baseRating + rams.offseasonAdjustment);
});
