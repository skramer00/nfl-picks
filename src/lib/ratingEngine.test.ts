import assert from "node:assert/strict";
import test from "node:test";
import { buildRatingState, isNeutralSite, type RatingGame } from "./ratingEngine";
import { predictionContext } from "./predictionContext";
import { matchupFavorability } from "./favorability";
import { replacementQuarterbackAdjustment } from "./modelRatings";
import { currentQuarterbackInput, quarterbackInputFromDepthChart } from "./quarterbackInputs";
import { probabilityMetrics } from "./probabilityMetrics";
import { buildPowerRankings } from "./powerRankings";
import type { GameRow } from "./gamesDb";
const prior: RatingGame = { id: "prior", week: 1, kickoff_at: "2026-09-13T17:00:00Z", updated_at: "2026-09-13T21:00:00Z", status: "final", away_score: 7, home_score: 35, away_team_id: "away", home_team_id: "home", away_team: { abbreviation: "KC" }, home_team: { abbreviation: "LAC" } };
const future = { ...prior, id: "future", week: 2, status: "scheduled", kickoff_at: "2026-09-20T17:00:00Z", away_score: null, home_score: null };
test("rankings and matchup probabilities share result updates without future leakage", () => {
  const before = predictionContext(future, [prior, future], new Date("2026-09-13T20:00:00Z"));
  const after = predictionContext(future, [prior, future], new Date("2026-09-14T00:00:00Z"));
  assert.ok(after.homeRating > before.homeRating);
  assert.ok(after.awayRating < before.awayRating);
  const p = (context: typeof before) => matchupFavorability("KC", "LAC", 2, 0, true, context).home;
  assert.ok(p(after) > p(before));
  const changedFuture = { ...future, status: "final", home_score: 0, away_score: 70, updated_at: "2026-09-20T22:00:00Z" };
  assert.deepEqual(predictionContext(future, [prior, changedFuture], new Date("2026-09-14T00:00:00Z")), after);
  const complete = { ...prior, kickoff_iso: prior.kickoff_at, away_team: { ...prior.away_team, id: "away", name: "Chiefs" }, home_team: { ...prior.home_team, id: "home", name: "Chargers" } } as GameRow;
  const ranks = buildPowerRankings([complete]);
  const ratings = buildRatingState([prior]);
  for (const rank of ranks) assert.equal(rank.rating, Math.round(ratings.get(rank.id)!));
});
test("neutral venue removes home edge and provider flag overrides venue heuristic", () => {
  assert.ok(isNeutralSite({ venue: "Tottenham Hotspur Stadium" }));
  assert.equal(isNeutralSite({ venue: "Tottenham Hotspur Stadium", neutral_site: false }), false);
  assert.equal(matchupFavorability("KC", "LAC", 2, 0, false, { awayRating: 1500, homeRating: 1500, neutralSite: true }).home, 0.5);
  assert.ok(matchupFavorability("KC", "LAC", 2, 0, false, { awayRating: 1500, homeRating: 1500, neutralSite: false }).home > 0.5);
});
test("unknown backup cannot improve a negatively rated starter", () => {
  assert.ok(replacementQuarterbackAdjustment({ quarterbackAdjustment: -25, backupQuarterbackAdjustment: 0, backupSampleWeight: 0 }) < -25);
});
test("QB refresh uses explicit out statuses and rejects stale or future inputs", () => {
  const input = quarterbackInputFromDepthChart({ depthchart: [{ positions: { qb: { position: { abbreviation: "QB" }, athletes: [ { displayName: "Patrick Mahomes", injuries: [{ status: "Out" }] }, { displayName: "Unknown Rookie" } ] } } }] }, "KC", 2026, 6, new Date("2026-10-15T00:00:00Z"));
  assert.ok(input);
  assert.equal(input.starter, "Unknown Rookie");
  assert.ok(input.adjustment < 0);
  assert.equal(currentQuarterbackInput([input], "KC", 6, new Date("2026-10-16T00:00:00Z")), input);
  assert.equal(currentQuarterbackInput([input], "KC", 6, new Date("2026-10-17T00:00:00Z")), undefined);
  assert.equal(currentQuarterbackInput([input], "KC", 6, new Date("2026-10-14T00:00:00Z")), undefined);
  assert.equal(currentQuarterbackInput([input], "KC", 7, new Date("2026-10-16T00:00:00Z")), undefined);
});
test("probability metrics handle calibration, impossible forecasts and ties", () => {
  assert.equal(probabilityMetrics([{ probability: .5, outcome: 0 }, { probability: .5, outcome: 1 }]).brier, .25);
  assert.equal(probabilityMetrics([{ probability: 1, outcome: 1 }, { probability: 0, outcome: 0 }]).brier, 0);
  assert.ok(Number.isFinite(probabilityMetrics([{ probability: 0, outcome: 1 }]).logLoss));
  assert.equal(probabilityMetrics([{ probability: .5, outcome: .5 }]).count, 0);
});
