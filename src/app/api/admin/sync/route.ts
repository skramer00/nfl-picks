import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import { finalResultHealth, gameDayHealth, scheduleHealth, snapshotHealth } from "@/lib/operationsHealth";
import { findActiveWeeks, syncResults } from "@/lib/results/sync";
import { runTrackedSync } from "@/lib/results/runSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEASON = 2026;

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const now = new Date();
    const [{ data: runs, error: runsError }, { data: overrides, error: overridesError }, { data: games, error: gamesError }, { data: snapshots, error: snapshotsError }, { data: deliveries, error: deliveriesError }] =
      await Promise.all([
        supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(20),
        supabase
          .from("favorability_overrides")
          .select("game_id, home_win_probability, reason, updated_at"),
        supabase.from("games").select("id, week, kickoff_at, status, away_score, home_score, winner_team_id").eq("season", SEASON).eq("season_type", "REG").order("kickoff_at"),
        supabase.from("model_prediction_snapshots").select("game_id, capture_is_pregame").eq("season", SEASON),
        supabase.from("pick_reminder_deliveries").select("status, scheduled_for, created_at").eq("season", SEASON).order("created_at", { ascending: false }).limit(100),
      ]);

    if (runsError) throw runsError;
    if (overridesError) throw overridesError;
    if (gamesError) throw gamesError;
    if (snapshotsError) throw snapshotsError;
    if (deliveriesError) throw deliveriesError;

    const gameRows = games ?? [];
    const deliveryRows = deliveries ?? [];
    const runRows = runs ?? [];
    const latestRun = runRows[0];
    const stuckRun = latestRun?.status === "running" && now.getTime() - new Date(latestRun.started_at).getTime() > 10 * 60 * 1000;
    const failedDeliveries = deliveryRows.filter((delivery) => delivery.status === "failed").length;
    const scheduledDeliveries = deliveryRows.filter((delivery) => delivery.status === "scheduled").length;

    return Response.json({
      runs: runRows,
      overrides: overrides ?? [],
      schedule: "Every 15 minutes near active games, with a daily 12:00 UTC fallback",
      system: {
        schedule: scheduleHealth(gameRows),
        snapshots: snapshotHealth(gameRows, snapshots ?? [], now),
        results: finalResultHealth(gameRows),
        reminders: { scheduled: scheduledDeliveries, failed: failedDeliveries, ready: failedDeliveries === 0 },
        sync: { stuck: Boolean(stuckRun), latestStatus: latestRun?.status ?? null },
        gameDay: gameDayHealth(gameRows, runRows, now),
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { week?: number; dryRun?: boolean };
    const requestedWeek = Number(body.week);
    const weeks = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 18
      ? [requestedWeek]
      : await findActiveWeeks(supabase, SEASON);

    if (weeks.length === 0) {
      return Response.json({ ok: true, message: "No games are in the active sync window.", weeks });
    }

    if (body.dryRun) {
      const summary = await syncResults({ supabase, season: SEASON, weeks, dryRun: true });
      return Response.json({ ok: true, summary });
    }

    const summary = await runTrackedSync({
      supabase,
      season: SEASON,
      weeks,
      source: "manual",
      requestedBy: user.id,
    });
    return Response.json({ ok: true, summary });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
