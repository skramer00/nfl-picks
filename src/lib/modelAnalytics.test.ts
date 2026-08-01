import assert from "node:assert/strict";
import test from "node:test";

import type { GameRow, Team } from "./gamesDb";
import { modelPerformance, pickDisagreements, projectedTeamRecord } from "./modelAnalytics";

const away: Team = { id: "away", abbreviation: "AWY", name: "Away", conference: "AFC", division: "East" };
const home: Team = { id: "home", abbreviation: "HME", name: "Home", conference: "NFC", division: "West" };

function game(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "game-1", season: 2026, week: 1, kickoff_iso: "2026-09-01T00:00:00Z",
    away_team_id: away.id, home_team_id: home.id, away_score: null, home_score: null,
    status: "scheduled", winner_team_id: null, home_win_prob: 0.7, away_win_prob: 0.3,
    favorability_override_reason: null, rest_advantage_team_id: null, rest_advantage_days: null,
    rest_adjustment: 0, playoff_round: null, updated_at: "2026-08-01T00:00:00Z",
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
