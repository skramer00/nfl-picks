import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import {
  DIVISION_MATCHUP_MAX,
  HOME_FIELD_ELO,
  MATCHUP_MODEL_VERSION,
  STANDARD_MATCHUP_MAX,
  matchupFavorability,
  teamStrength,
} from "./favorability";
import { buildRestAdvantageMap, type RestAdvantage } from "./restAdvantage";

type SnapshotTeam = {
  id: string;
  abbreviation: string;
  conference: string;
  division: string;
};

export type SnapshotGame = {
  id: string;
  season: number;
  week: number;
  kickoff_at: string;
  away_team_id: string;
  home_team_id: string;
  away_team: SnapshotTeam;
  home_team: SnapshotTeam;
};

export type SnapshotOverride = {
  game_id: string;
  home_win_probability: number;
  reason: string;
};

export function predictionSnapshotForGame({
  game,
  override,
  rest,
  source,
  now,
}: {
  game: SnapshotGame;
  override?: SnapshotOverride;
  rest?: RestAdvantage;
  source: "cron" | "manual";
  now: Date;
}): Database["public"]["Tables"]["model_prediction_snapshots"]["Insert"] {
  const isDivisionMatchup =
    game.away_team.conference === game.home_team.conference &&
    game.away_team.division === game.home_team.division;
  const restAdvantageDays = Math.round(Math.abs(rest?.homeAdvantageDays ?? 0));
  const calculated = matchupFavorability(
    game.away_team.abbreviation,
    game.home_team.abbreviation,
    game.week,
    rest?.homeAdvantageDays ?? 0,
    isDivisionMatchup
  );
  const awayProbability = override
    ? 1 - override.home_win_probability
    : calculated.away;
  const homeProbability = override
    ? override.home_win_probability
    : calculated.home;

  return {
    game_id: game.id,
    season: game.season,
    week: game.week,
    kickoff_at: game.kickoff_at,
    capture_is_pregame: now.getTime() <= new Date(game.kickoff_at).getTime(),
    capture_source: source,
    model_version: MATCHUP_MODEL_VERSION,
    away_win_probability: Number(awayProbability.toFixed(4)),
    home_win_probability: Number(homeProbability.toFixed(4)),
    away_team_rating: teamStrength(game.away_team.abbreviation),
    home_team_rating: teamStrength(game.home_team.abbreviation),
    home_field_elo: HOME_FIELD_ELO,
    is_division_matchup: isDivisionMatchup,
    division_cap: isDivisionMatchup ? DIVISION_MATCHUP_MAX : STANDARD_MATCHUP_MAX,
    week_one_regression: game.week === 1,
    rest_advantage_team_id:
      !override && restAdvantageDays > 0
        ? rest!.homeAdvantageDays > 0
          ? game.home_team_id
          : game.away_team_id
        : null,
    rest_advantage_days: !override && restAdvantageDays > 0 ? restAdvantageDays : null,
    rest_adjustment: override ? 0 : Number(Math.abs(calculated.restAdjustment).toFixed(4)),
    manual_override: Boolean(override),
    manual_override_reason: override?.reason ?? null,
  };
}

export async function capturePredictionSnapshots({
  supabase,
  season,
  weeks,
  source,
  now = new Date(),
  lookAheadHours = 30,
}: {
  supabase: SupabaseClient<Database>;
  season: number;
  weeks: number[];
  source: "cron" | "manual";
  now?: Date;
  lookAheadHours?: number;
}) {
  const [{ data: schedule, error: scheduleError }, { data: existing, error: existingError }] =
    await Promise.all([
      supabase
        .from("games")
        .select(`
          id, season, week, kickoff_at, away_team_id, home_team_id,
          away_team:teams!games_away_team_id_fkey(id, abbreviation, conference, division),
          home_team:teams!games_home_team_id_fkey(id, abbreviation, conference, division)
        `)
        .eq("season", season)
        .eq("season_type", "REG")
        .order("kickoff_at", { ascending: true }),
      supabase
        .from("model_prediction_snapshots")
        .select("game_id")
        .eq("season", season)
        .in("week", weeks),
    ]);

  if (scheduleError) throw scheduleError;
  if (existingError) throw existingError;

  const games = (schedule ?? []) as unknown as SnapshotGame[];
  const existingIds = new Set((existing ?? []).map((snapshot) => snapshot.game_id));
  const captureDeadline = now.getTime() + lookAheadHours * 60 * 60 * 1000;
  const eligible = games.filter(
    (game) =>
      weeks.includes(game.week) &&
      new Date(game.kickoff_at).getTime() <= captureDeadline
  );
  const pending = eligible.filter((game) => !existingIds.has(game.id));

  if (pending.length === 0) {
    return { eligible: eligible.length, captured: 0, alreadyLocked: eligible.length, late: 0 };
  }

  const { data: overrides, error: overridesError } = await supabase
    .from("favorability_overrides")
    .select("game_id, home_win_probability, reason")
    .in("game_id", pending.map((game) => game.id));
  if (overridesError) throw overridesError;

  const overrideByGame = new Map(
    ((overrides ?? []) as SnapshotOverride[]).map((override) => [override.game_id, override])
  );
  const restByGame = buildRestAdvantageMap(games);
  const rows = pending.map((game) =>
    predictionSnapshotForGame({
      game,
      override: overrideByGame.get(game.id),
      rest: restByGame.get(game.id),
      source,
      now,
    })
  );
  const { error: insertError } = await supabase
    .from("model_prediction_snapshots")
    .upsert(rows, { onConflict: "game_id", ignoreDuplicates: true });
  if (insertError) throw insertError;

  return {
    eligible: eligible.length,
    captured: rows.length,
    alreadyLocked: eligible.length - rows.length,
    late: rows.filter((row) => !row.capture_is_pregame).length,
  };
}
