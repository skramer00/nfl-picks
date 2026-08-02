import assert from "node:assert/strict";
import test from "node:test";

import type { GameRow, Team } from "./gamesDb";
import {
  confidenceCalibration,
  modelPerformance,
  matchupExplanation,
  pickDisagreements,
  projectedTeamRecord,
  seasonModelInsights,
  userPickPerformance,
} from "./modelAnalytics";

const away: Team = { id: "away", abbreviation: "AWY", name: "Away", conference: "AFC", division: "East" };
const home: Team = { id: "home", abbreviation: "HME", name: "Home", conference: "NFC", division: "West" };

function game(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "game-1", season: 2026, week: 1, kickoff_iso: "2026-09-01T00:00:00Z",
    away_team_id: away.id, home_team_id: home.id, away_score: null, home_score: null,
    status: "scheduled", winner_team_id: null, home_win_prob: 0.7, away_win_prob: 0.3,
    favorability_override_reason: null, rest_advantage_team_id: null, rest_advantage_days: null,
    rest_adjustment: 0, playoff_round: null, updated_at: "2026-08-01T00:00:00Z",
    prediction_captured_at: "2026-08-31T00:00:00Z", prediction_model_version: "test",
    prediction_snapshot_is_pregame: true,
    away_team: away, home_team: home, ...overrides,
  };
}

test("model performance scores favorites against final results", () => {
  const results = modelPerformance([
    game({ status: "final", winner_team_id: home.id }),
    game({ id: "game-2", week: 2, status: "final", winner_team_id: away.id }),
  ]);
  assert.equal(results.accuracy, 50);
  assert.equal(results.favoriteWins, 1);
  assert.equal(results.underdogWins, 1);
});

test("model performance excludes finals without a pregame snapshot", () => {
  const results = modelPerformance([
    game({ status: "final", winner_team_id: home.id, prediction_snapshot_is_pregame: false }),
  ]);
  assert.equal(results.finals, 0);
  assert.equal(results.unscoredFinals, 1);
});

test("disagreements include only future picks against the favorite", () => {
  const rows = pickDisagreements([game()], { "game-1": away.id });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].favorite.teamId, home.id);
});

test("projected record combines final winners and future favorites", () => {
  const record = projectedTeamRecord([
    game({ status: "final", winner_team_id: away.id }),
    game({ id: "game-2", week: 2 }),
  ], home.id);
  assert.deepEqual(record, { wins: 1, losses: 1, ties: 0 });
});

test("confidence calibration groups final games by favorite probability", () => {
  const buckets = confidenceCalibration([
    game({ status: "final", winner_team_id: home.id, home_win_prob: 0.53, away_win_prob: 0.47 }),
    game({ id: "game-2", status: "final", winner_team_id: away.id, home_win_prob: 0.62, away_win_prob: 0.38 }),
  ]);
  assert.deepEqual(
    buckets.map(({ label, games, accuracy }) => ({ label, games, accuracy })),
    [
      { label: "Toss-up", games: 1, accuracy: 100 },
      { label: "Slight edge", games: 0, accuracy: null },
      { label: "Clear edge", games: 1, accuracy: 0 },
      { label: "Strong edge", games: 0, accuracy: null },
    ]
  );
});

test("user pick performance separates picks with and against the model", () => {
  const results = userPickPerformance(
    [
      game({ status: "final", winner_team_id: home.id }),
      game({ id: "game-2", status: "final", winner_team_id: away.id }),
    ],
    { "game-1": home.id, "game-2": away.id }
  );
  assert.equal(results.accuracy, 100);
  assert.deepEqual(results.withModel, { picks: 1, correct: 1, accuracy: 100 });
  assert.deepEqual(results.againstModel, { picks: 1, correct: 1, accuracy: 100 });
});

test("matchup explanation names the model inputs in plain language", () => {
  const standardReasons = matchupExplanation(game({
    rest_advantage_team_id: home.id,
    rest_advantage_days: 3,
  }));
  assert.equal(standardReasons.some((reason) => reason.includes("home-field")), true);
  assert.equal(standardReasons.some((reason) => reason.includes("3 more days")), true);

  const adjustedReasons = matchupExplanation(game({
    favorability_override_reason: "Quarterback availability",
  }));
  assert.equal(adjustedReasons[0], "Manual adjustment: Quarterback availability");
  assert.equal(adjustedReasons.some((reason) => reason.includes("instead of")), true);
});

test("season insights rank matchups, schedules, divisions, and confidence", () => {
  const rows = [
    game(),
    game({ id: "game-2", week: 2, home_win_prob: 0.52, away_win_prob: 0.48 }),
  ];
  const insights = seasonModelInsights(rows);
  assert.equal(insights.biggestFavorites[0].game.id, "game-1");
  assert.equal(insights.closestGames[0].game.id, "game-2");
  assert.equal(insights.favorableSchedules[0].team.id, home.id);
  assert.equal(insights.confidence.reduce((sum, bucket) => sum + bucket.games, 0), 2);
});
