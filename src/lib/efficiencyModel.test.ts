import assert from "node:assert/strict";
import test from "node:test";
import { availableEfficiency, efficiencyShadowContext, fitEfficiency, type EfficiencyObservation } from "./efficiencyModel";
import { aggregateEfficiency } from "./efficiencySync";
import { marketQuote, noVigHomeProbability } from "./marketOdds";
import { isPublishedForecast } from "./forecastRoles";
import { preseasonTeamStrength } from "./modelRatings";

const row: EfficiencyObservation = { game_id: "g1", season: 2026, week: 1, team: "LAR", opponent: "SF", kickoff_at: "2026-09-10T00:00:00Z", observed_at: "2026-09-12T00:00:00Z", content_hash: "v1", source: "test", plays: 60, epa: 6, successes: 30, pass_plays: 40, pass_epa: 5, rush_plays: 20, rush_epa: 1 };
test("efficiency replay sees only revisions observed before its cutoff", () => {
  const correction = { ...row, epa: -20, observed_at: "2026-09-20T00:00:00Z", content_hash: "v2" };
  assert.deepEqual(availableEfficiency([row, correction], new Date("2026-09-15"), 2026), [row]);
  assert.deepEqual(availableEfficiency([correction, row], new Date("2026-09-21"), 2026), [correction]);
  assert.equal(availableEfficiency([row], new Date("2026-09-11"), 2026).length, 0);
  assert.equal(availableEfficiency([row], new Date("2026-09-21"), 2025).length, 0);
  assert.equal(availableEfficiency([{ ...row, observed_at: "bad" }], new Date("2026-09-21"), 2026).length, 0);
});
test("efficiency fitting shrinks sparse evidence and rewards better offense", () => {
  const zero = fitEfficiency([]).get("LAR")!;
  assert.equal(zero.delta, 0);
  const opponent = { ...row, team: "SF", opponent: "LAR", epa: 0 };
  const low = fitEfficiency([{ ...row, epa: -60 }, opponent]).get("LAR")!;
  const high = fitEfficiency([{ ...row, epa: 60 }, opponent]).get("LAR")!;
  assert.ok(high.delta > low.delta);
  assert.ok(Math.abs(high.delta) <= 100);
  assert.equal(high.plays, 60);
});
test("shadow blends estimates, preserves QB changes and cannot enter published picks", () => {
  const game = { id: "future", season: 2026, week: 3, kickoff_at: "2026-09-23T00:00:00Z", away_team_id: "a", home_team_id: "h", away_team: { abbreviation: "SF" }, home_team: { abbreviation: "LAR" } };
  const live = { awayRating: preseasonTeamStrength("SF"), homeRating: preseasonTeamStrength("LAR"), neutralSite: false, asOf: "2026-09-22", awayQuarterback: null, homeQuarterback: null };
  assert.equal(efficiencyShadowContext(game, live, [row], new Date("2026-09-22")), null);
  const rows = [row, { ...row, game_id: "g2" }, { ...row, team: "SF", opponent: "LAR" }, { ...row, game_id: "g2", team: "SF", opponent: "LAR" }];
  const trial = efficiencyShadowContext(game, live, rows, new Date("2026-09-22"))!;
  assert.ok(trial);
  const shifted = efficiencyShadowContext(game, { ...live, homeRating: live.homeRating + 10, homeQuarterback: { season: 2026, week: 3, team_abbreviation: "LAR", observed_at: "2026-09-22", starter: "test", status: "active", adjustment: 40, source: "test" } }, rows, new Date("2026-09-22"))!;
  assert.ok(Math.abs(shifted.homeRating - trial.homeRating - 10) < 1e-8);
  assert.equal(isPublishedForecast("2026.6-efficiency-shadow"), false);
  assert.equal(isPublishedForecast("2026.4-baseline"), false);
  assert.equal(isPublishedForecast("2026.5"), true);
  assert.equal(isPublishedForecast("2026.4"), true);
});
test("aggregation excludes noncompetitive play types, partial games, unknown teams and early results", () => {
  const g = { id: "g1", week: 1, kickoff_at: row.kickoff_at, status: "final", away_team: { abbreviation: "SF" }, home_team: { abbreviation: "LAR" } };
  const p = { season_type: "REG", week: "1", away_team: "SF", home_team: "LA", posteam: "LA", defteam: "SF", play_type: "pass", epa: ".1", success: "1" };
  const valid = [...Array.from({ length: 25 }, () => p), ...Array.from({ length: 25 }, () => ({ ...p, posteam: "SF", defteam: "LA" }))];
  const dirty = [...valid, { ...p, qb_kneel: "1" }, { ...p, qb_spike: "1" }, { ...p, no_play: "1" }, { ...p, play_type: "punt" }, { ...p, epa: "NA" }, { ...p, posteam: "DAL" }];
  const result = aggregateEfficiency(dirty, [g], 2026, new Date("2026-09-12"));
  assert.equal(result.length, 2); assert.equal(result[0].plays, 25); assert.equal(result[0].epa, 2.5);
  assert.equal(aggregateEfficiency(valid, [g], 2026, new Date("2026-09-10T05:00Z")).length, 0);
  assert.equal(aggregateEfficiency(valid.slice(0, 25), [g], 2026, new Date("2026-09-12")).length, 0);
});
test("market parsing removes margin and rejects in-play, missing and invalid odds", () => {
  assert.ok(Math.abs(noVigHomeProbability(-155, 130)! - .582992641) < 1e-8);
  assert.equal(noVigHomeProbability(0, 130), null);
  assert.equal(noVigHomeProbability(NaN, 130), null);
  const doc = { header: { competitions: [{ status: { type: { state: "pre" } } }] }, pickcenter: [{ provider: { name: "DraftKings" }, homeTeamOdds: { moneyLine: -155 }, awayTeamOdds: { moneyLine: 130 } }] };
  assert.ok(marketQuote(doc, "123", new Date()));
  doc.header.competitions[0].status.type.state = "in";
  assert.equal(marketQuote(doc, "123", new Date()), null);
  assert.equal(marketQuote({}, "123", new Date()), null);
});
