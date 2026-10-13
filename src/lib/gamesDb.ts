import { supabase } from "./supabaseClient";
import { predictionContext } from "./predictionContext";
import type { QuarterbackInput } from "./quarterbackInputs";
import type { RatingGame } from "./ratingEngine";
import type { Database } from "./database.types";
import { matchupFavorability } from "./favorability";
import { buildRestAdvantageMap, type RestAdvantage } from "./restAdvantage";

export type Team = {
  id: string;
  abbreviation: string;
  name: string;
  conference: string;
  division: string;
};

export type ScheduleGame = {
  model_context?: ReturnType<typeof predictionContext>;
  neutral_site?: boolean | null;
  prediction_forecast_kind?: string;
  id: string;
  week: number;
  kickoff_at: string;
  venue: string | null;
  status: string;
  away_team_id: string;
  home_team_id: string;
  away_team: Team;
  home_team: Team;
  away_win_prob: number;
  home_win_prob: number;
  favorability_override_reason: string | null;
  rest_advantage_team_id: string | null;
  rest_advantage_days: number | null;
  rest_adjustment: number;
  prediction_captured_at: string | null;
  prediction_model_version: string | null;
  prediction_snapshot_is_pregame: boolean;
};

// Compatibility shape used by the existing admin and My Picks screens.
export type Forecast = Database["public"]["Tables"]["model_forecasts"]["Row"];

export type GameRow = {
  venue?: string | null;
  neutral_site?: boolean | null;
  model_context?: ReturnType<typeof predictionContext>;
  forecasts?: Forecast[];
  prediction_forecast_kind?: string;
  id: string;
  season: number;
  week: number;
  kickoff_iso: string;
  away_team_id: string;
  home_team_id: string;
  away_score: number | null;
  home_score: number | null;
  status: string;
  winner_team_id: string | null;
  home_win_prob: number | null;
  away_win_prob: number | null;
  favorability_override_reason: string | null;
  rest_advantage_team_id: string | null;
  rest_advantage_days: number | null;
  rest_adjustment: number;
  playoff_round: string | null;
  updated_at: string;
  prediction_captured_at: string | null;
  prediction_model_version: string | null;
  prediction_snapshot_is_pregame: boolean;
  away_team: Team;
  home_team: Team;
};

type FavorabilityOverride = {
  game_id: string;
  home_win_probability: number;
  reason: string;
};

type PredictionSnapshot = {
  forecast_kind?: string;
  game_id: string;
  captured_at: string;
  capture_is_pregame: boolean;
  model_version: string;
  away_win_probability: number;
  home_win_probability: number;
  manual_override_reason: string | null;
  rest_advantage_team_id: string | null;
  rest_advantage_days: number | null;
  rest_adjustment: number;
};

function predictionForGame(
  calculated: ReturnType<typeof favorabilityForGame>,
  snapshot?: PredictionSnapshot
) {
  if (!snapshot) {
    return {
      ...calculated,
      prediction_forecast_kind: "live",
      prediction_captured_at: null,
      prediction_model_version: null,
      prediction_snapshot_is_pregame: false,
    };
  }
  return {
    away: Number(snapshot.away_win_probability),
    home: Number(snapshot.home_win_probability),
    reason: snapshot.manual_override_reason,
    restAdvantageTeamId: snapshot.rest_advantage_team_id,
    restAdvantageDays: snapshot.rest_advantage_days,
    restAdjustment: Number(snapshot.rest_adjustment),
    prediction_forecast_kind: snapshot.forecast_kind ?? "early",
    prediction_captured_at: snapshot.captured_at,
    prediction_model_version: snapshot.model_version,
    prediction_snapshot_is_pregame: snapshot.capture_is_pregame,
  };
}

async function getFavorabilityOverrides(gameIds: string[]) {
  if (gameIds.length === 0) return new Map<string, FavorabilityOverride>();
  const { data, error } = await supabase
    .from("favorability_overrides")
    .select("game_id, home_win_probability, reason")
    .in("game_id", gameIds);
  if (error) throw error;
  return new Map((data ?? []).map((override) => [override.game_id, override]));
}

function favorabilityForGame(
  game: RatingGame & { away_team: Team; home_team: Team },
  overrides: Map<string, FavorabilityOverride>,
  rest?: RestAdvantage,
  context?: ReturnType<typeof predictionContext>
) {
  const override = overrides.get(game.id);
  if (override) {
    return {
      away: 1 - override.home_win_probability,
      home: override.home_win_probability,
      reason: override.reason,
      restAdvantageTeamId: null,
      restAdvantageDays: null,
      restAdjustment: 0,
    };
  }
  const calculated = matchupFavorability(
    game.away_team.abbreviation,
    game.home_team.abbreviation,
    game.week,
    rest?.homeAdvantageDays ?? 0,
    game.away_team.conference === game.home_team.conference &&
      game.away_team.division === game.home_team.division,
    context
  );
  const restAdvantageDays = Math.round(Math.abs(rest?.homeAdvantageDays ?? 0));
  return {
    ...calculated,
    reason: null,
    restAdvantageTeamId:
      restAdvantageDays > 0
        ? rest!.homeAdvantageDays > 0
          ? game.home_team_id
          : game.away_team_id
        : null,
    restAdvantageDays: restAdvantageDays > 0 ? restAdvantageDays : null,
    restAdjustment: Math.abs(calculated.restAdjustment),
  };
}

export async function getGamesByWeek(season: number, week: number): Promise<ScheduleGame[]> {
  const games = await getGamesBySeason(season);
  return games.filter((game) => game.week === week).map((game) => ({
    ...game, kickoff_at: game.kickoff_iso, venue: game.venue ?? null,
    away_win_prob: game.away_win_prob ?? 0.5, home_win_prob: game.home_win_prob ?? 0.5,
  }));
}

async function getForecasts(season: number) {
  const data: Forecast[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from("model_forecasts").select("*").eq("season", season)
      .order("game_id").order("model_version").order("forecast_kind").range(offset, offset + 499);
    if (result.error) throw result.error;
    data.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return { data, error: null };
  }
}

export async function getGamesBySeason(season: number): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from("games")
    .select(
      `id, season, week, kickoff_at, away_team_id, home_team_id, away_score, home_score, venue, neutral_site,
       status, winner_team_id, updated_at,
       away_team:teams!games_away_team_id_fkey(id, abbreviation, name, conference, division),
       home_team:teams!games_home_team_id_fkey(id, abbreviation, name, conference, division)`
    )
    .eq("season", season)
    .eq("season_type", "REG")
    .order("week", { ascending: true })
    .order("kickoff_at", { ascending: true });

  if (error) throw error;

  const games = (data ?? []) as unknown as Array<
    Omit<GameRow, "kickoff_iso" | "home_win_prob" | "away_win_prob" | "favorability_override_reason" | "rest_advantage_team_id" | "rest_advantage_days" | "rest_adjustment" | "playoff_round" | "prediction_captured_at" | "prediction_model_version" | "prediction_snapshot_is_pregame"> & {
      kickoff_at: string;
    }
  >;

  const [overrides, snapshotResult, forecastResult, quarterbackResult] = await Promise.all([
    getFavorabilityOverrides(games.map((game) => game.id)),
    supabase
      .from("model_prediction_snapshots")
      .select("game_id, captured_at, capture_is_pregame, model_version, away_win_probability, home_win_probability, manual_override_reason, rest_advantage_team_id, rest_advantage_days, rest_adjustment")
      .eq("season", season),
    getForecasts(season),
    supabase.from("model_quarterback_inputs").select("*").eq("season", season),
  ]);
  if (snapshotResult.error) throw snapshotResult.error;
  if (forecastResult.error) throw forecastResult.error;
  if (quarterbackResult.error) throw quarterbackResult.error;
  const snapshots = new Map(
    ((snapshotResult.data ?? []) as PredictionSnapshot[]).map((snapshot) => [snapshot.game_id, snapshot])
  );
  const restByGame = buildRestAdvantageMap(games);

  const now = new Date();
  return games.map((game) => {
    const forecasts = (forecastResult.data ?? []).filter((row) => row.game_id === game.id && new Date(row.captured_at) < new Date(game.kickoff_at));
    const current = forecasts.filter((row) => !row.model_version.endsWith("-baseline"))
      .sort((a, b) => Number(b.forecast_kind === "final") - Number(a.forecast_kind === "final") || b.captured_at.localeCompare(a.captured_at))[0];
    const archived = current ?? snapshots.get(game.id);
    const snapshot = new Date(game.kickoff_at) <= now || current?.forecast_kind === "final" ? archived : undefined;
    const context = predictionContext(game, games, now, (quarterbackResult.data ?? []) as QuarterbackInput[]);
    const favorability = predictionForGame(
      favorabilityForGame(game, overrides, restByGame.get(game.id), context),
      snapshot
    );
    return {
      ...game,
      model_context: snapshot ? (current?.inputs && typeof current.inputs === "object" && "awayRating" in current.inputs ? current.inputs as ReturnType<typeof predictionContext> : undefined) : context,
      forecasts,
      prediction_forecast_kind: favorability.prediction_forecast_kind,
      kickoff_iso: game.kickoff_at,
      home_win_prob: favorability.home,
      away_win_prob: favorability.away,
      favorability_override_reason: favorability.reason,
      rest_advantage_team_id: favorability.restAdvantageTeamId,
      rest_advantage_days: favorability.restAdvantageDays,
      rest_adjustment: favorability.restAdjustment,
      playoff_round: null,
      prediction_captured_at: favorability.prediction_captured_at,
      prediction_model_version: favorability.prediction_model_version,
      prediction_snapshot_is_pregame: favorability.prediction_snapshot_is_pregame,
    };
  });
}
