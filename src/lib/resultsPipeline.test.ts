import assert from "node:assert/strict";
import test from "node:test";

import type { GameRow, Team } from "./gamesDb";
import { finalResultHealth } from "./operationsHealth";
import { buildPostseasonProjection } from "./postseasonProjection";
import { syncResults } from "./results/sync";
import { buildWeeklyRecap } from "./weeklyRecap";

type StoredGame = {
  id: string;
  week: number;
  kickoff_at: string;
  away_team_id: string;
  home_team_id: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  winner_team_id: string | null;
  updated_at?: string;
};

function queryResult<T>(data: T) {
  return {
    eq() { return this; },
    in() { return this; },
    then(resolve: (value: { data: T; error: null }) => unknown) {
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
}

function fakeSupabase(game: StoredGame) {
  const teams = [
    { id: "sea", abbreviation: "SEA" },
    { id: "sf", abbreviation: "SF" },
  ];

  return {
    from(table: string) {
      if (table === "teams") {
        return { select: () => queryResult(teams) };
      }
      if (table === "games") {
        return {
          select: () => queryResult([game]),
          update(values: Partial<StoredGame>) {
            return {
              eq() {
                Object.assign(game, values);
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

const team = (
  id: string,
  abbreviation: string,
  name: string,
  conference: string,
  division: string,
): Team => ({ id, abbreviation, name, conference, division });

test("a final score flows from the provider into health, recap, and postseason projections", async () => {
  const storedGame: StoredGame = {
    id: "week-1-sea-sf",
    week: 1,
    kickoff_at: "2026-09-13T20:05:00Z",
    away_team_id: "sea",
    home_team_id: "sf",
    status: "scheduled",
    away_score: null,
    home_score: null,
    winner_team_id: null,
  };

  const summary = await syncResults({
    supabase: fakeSupabase(storedGame) as never,
    season: 2026,
    weeks: [1],
    fetchWeek: async () => [{
      providerId: "provider-game-1",
      week: 1,
      kickoffAt: storedGame.kickoff_at,
      away: "SEA",
      home: "SF",
      status: "final",
      awayScore: 27,
      homeScore: 20,
    }],
  });

  assert.deepEqual(
    { matched: summary.matched, updated: summary.updated, unmatched: summary.unmatched },
    { matched: 1, updated: 1, unmatched: [] },
  );
  assert.equal(storedGame.status, "final");
  assert.equal(storedGame.winner_team_id, "sea");

  const game: GameRow = {
    id: storedGame.id,
    season: 2026,
    week: 1,
    kickoff_iso: storedGame.kickoff_at,
    away_team_id: storedGame.away_team_id,
    home_team_id: storedGame.home_team_id,
    away_score: storedGame.away_score,
    home_score: storedGame.home_score,
    status: storedGame.status,
    winner_team_id: storedGame.winner_team_id,
    home_win_prob: 0.4,
    away_win_prob: 0.6,
    favorability_override_reason: null,
    rest_advantage_team_id: null,
    rest_advantage_days: null,
    rest_adjustment: 0,
    playoff_round: null,
    updated_at: storedGame.updated_at ?? "",
    prediction_captured_at: "2026-09-13T19:00:00Z",
    prediction_model_version: "pipeline-test",
    prediction_snapshot_is_pregame: true,
    away_team: team("sea", "SEA", "Seattle Seahawks", "NFC", "West"),
    home_team: team("sf", "SF", "San Francisco 49ers", "NFC", "West"),
  };

  assert.equal(finalResultHealth([{
    id: game.id,
    week: game.week,
    kickoff_at: game.kickoff_iso,
    status: game.status,
    away_score: game.away_score,
    home_score: game.home_score,
    winner_team_id: game.winner_team_id,
  }]).ready, true);

  const recap = buildWeeklyRecap([game], { [game.id]: "sea" }, 1);
  assert.deepEqual(
    { finalPicks: recap.finalPicks, correct: recap.correct, accuracy: recap.accuracy, pending: recap.pending },
    { finalPicks: 1, correct: 1, accuracy: 100, pending: 0 },
  );

  const nfc = buildPostseasonProjection([game], {}, "model").find(
    (conference) => conference.conference === "NFC",
  );
  const seattle = nfc?.teams.find((projectedTeam) => projectedTeam.id === "sea");
  assert.equal(seattle?.wins, 1);
  assert.equal(seattle?.losses, 0);
});
