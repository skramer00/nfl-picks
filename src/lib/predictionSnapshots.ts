import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import {
  DIVISION_MATCHUP_MAX,
  HOME_FIELD_ELO,
  MATCHUP_MODEL_VERSION,
  STANDARD_MATCHUP_MAX,
  matchupFavorability,
} from "./favorability";
import { predictionContext } from "./predictionContext";
import type { QuarterbackInput } from "./quarterbackInputs";
import type { RatingGame } from "./ratingEngine";
import { modelRatingAudit, quarterbackAvailability } from "./modelRatings";
import { buildRestAdvantageMap, type RestAdvantage } from "./restAdvantage";

type SnapshotTeam = {
  id: string;
  abbreviation: string;
  conference: string;
  division: string;
};

export type SnapshotGame = RatingGame & {
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
  schedule = [],
  quarterbacks = [],
}: {
  game: SnapshotGame;
  override?: SnapshotOverride;
  rest?: RestAdvantage;
  source: "cron" | "manual";
  now: Date;
  schedule?: RatingGame[];
  quarterbacks?: QuarterbackInput[];
}): Database["public"]["Tables"]["model_prediction_snapshots"]["Insert"] {
  const isDivisionMatchup =
    game.away_team.conference === game.home_team.conference &&
    game.away_team.division === game.home_team.division;
  const restAdvantageDays = Math.round(Math.abs(rest?.homeAdvantageDays ?? 0));
  const context = predictionContext(game, schedule, now, quarterbacks);
  const calculated = matchupFavorability(
    game.away_team.abbreviation,
    game.home_team.abbreviation,
    game.week,
    rest?.homeAdvantageDays ?? 0,
    isDivisionMatchup,
    context
  );
  const awayProbability = override
    ? 1 - override.home_win_probability
    : calculated.away;
  const homeProbability = override
    ? override.home_win_probability
    : calculated.home;

  return {
    game_id: game.id,
    captured_at: now.toISOString(),
    season: game.season,
    week: game.week,
    kickoff_at: game.kickoff_at,
    capture_is_pregame: now.getTime() < new Date(game.kickoff_at).getTime(),
    capture_source: source,
    model_version: MATCHUP_MODEL_VERSION,
    away_win_probability: Number(awayProbability.toFixed(4)),
    home_win_probability: Number(homeProbability.toFixed(4)),
    away_team_rating: Math.round(context.awayRating),
    home_team_rating: Math.round(context.homeRating),
    home_field_elo: context.neutralSite ? 0 : HOME_FIELD_ELO,
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
          id, season, week, kickoff_at, away_team_id, home_team_id, status, away_score, home_score, updated_at, venue, neutral_site,
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
      new Date(game.kickoff_at).getTime() <= captureDeadline &&
      new Date(game.kickoff_at).getTime() > now.getTime()
  );
  if (!eligible.length) return { eligible: 0, captured: 0, alreadyLocked: 0, late: 0 };
  const pending = eligible.filter((game) => !existingIds.has(game.id));

  const { data: overrides, error: overridesError } = await supabase
    .from("favorability_overrides")
    .select("game_id, home_win_probability, reason")
    .in("game_id", eligible.map((game) => game.id));
  if (overridesError) throw overridesError;

  const overrideByGame = new Map(
    ((overrides ?? []) as SnapshotOverride[]).map((override) => [override.game_id, override])
  );
  const { data: quarterbacks, error: quarterbackError } = await supabase.from("model_quarterback_inputs").select("*").eq("season", season);
  if (quarterbackError) throw quarterbackError;
  const restByGame = buildRestAdvantageMap(games);
  const rows = pending.map((game) =>
    predictionSnapshotForGame({
      game,
      override: overrideByGame.get(game.id),
      rest: restByGame.get(game.id),
      source,
      now,
      schedule: games,
      quarterbacks: quarterbacks ?? [],
    })
  );
  const { error: insertError } = rows.length ? await supabase
    .from("model_prediction_snapshots")
    .upsert(rows, { onConflict: "game_id", ignoreDuplicates: true }) : { error: null };
  if (insertError) throw insertError;

  // Keep the original archive intact and append independently versioned early/final
  // forecasts. The final window starts one hour before kickoff, after inactive lists.
  const forecasts: Database["public"]["Tables"]["model_forecasts"]["Insert"][] = [];
  for (const game of eligible) {
    const kind = new Date(game.kickoff_at).getTime() - now.getTime() <= 3600000 ? "final" : "early";
    const snapshot = predictionSnapshotForGame({ game, override: overrideByGame.get(game.id), rest: restByGame.get(game.id), source, now, schedule: games, quarterbacks: quarterbacks ?? [] });
    const context = predictionContext(game, games, now, quarterbacks ?? []);
    const automatic = predictionSnapshotForGame({ game, rest: restByGame.get(game.id), source, now, schedule: games, quarterbacks: quarterbacks ?? [] });
    forecasts.push({ ...snapshot, forecast_kind: kind, automatic_home_probability: automatic.home_win_probability, inputs: JSON.parse(JSON.stringify(context)) });
    // Parallel unchanged preseason baseline at the same timestamp, without manual overrides.
    const legacyRating = (team: string) => {
      const audit = modelRatingAudit(team);
      if (!audit) return 1500;
      const availability = quarterbackAvailability(team, game.week);
      return audit.rating - audit.quarterbackAdjustment + audit.quarterbackAdjustment * availability + audit.backupQuarterbackAdjustment * (1 - availability);
    };
    const legacy = matchupFavorability(game.away_team.abbreviation, game.home_team.abbreviation, game.week, restByGame.get(game.id)?.homeAdvantageDays ?? 0, snapshot.is_division_matchup, {
      awayRating: legacyRating(game.away_team.abbreviation), homeRating: legacyRating(game.home_team.abbreviation), neutralSite: false,
    });
    forecasts.push({ ...snapshot, forecast_kind: kind, model_version: "2026.4-baseline", home_field_elo: HOME_FIELD_ELO,
      away_team_rating: legacyRating(game.away_team.abbreviation), home_team_rating: legacyRating(game.home_team.abbreviation),
      manual_override: false, manual_override_reason: null,
      home_win_probability: Number(legacy.home.toFixed(4)), away_win_probability: Number((1 - legacy.home).toFixed(4)),
      automatic_home_probability: Number(legacy.home.toFixed(4)), inputs: { baseline: true } });
  }
  if (forecasts.length) {
    const { error } = await supabase.from("model_forecasts").upsert(forecasts, { onConflict: "game_id,model_version,forecast_kind", ignoreDuplicates: true });
    if (error) throw error;
  }
  return {
    eligible: eligible.length,
    captured: rows.length,
    alreadyLocked: eligible.length - rows.length,
    late: rows.filter((row) => !row.capture_is_pregame).length,
  };
}
