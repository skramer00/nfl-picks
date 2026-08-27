import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkResultAttentionAlert, checkStaleSyncAlert, sendSyncFailureAlert } from "@/lib/gameDayAlerts";
import { findActiveWeeks } from "@/lib/results/sync";
import { runTrackedSync } from "@/lib/results/runSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEASON = 2026;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearerAuthorized = request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const previewAuthorized = request.headers.get("x-cron-secret") === cronSecret;

  if (!cronSecret || (!bearerAuthorized && !previewAuthorized)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  let weeks: number[] = [];
  try {
    const requestedWeek = Number(new URL(request.url).searchParams.get("week"));
    weeks = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 18
      ? [requestedWeek]
      : await findActiveWeeks(supabase, SEASON);

    if (weeks.length === 0) {
      return Response.json({ ok: true, message: "No games are in the active sync window.", weeks });
    }

    let staleAlert: unknown = null;
    try {
      staleAlert = await checkStaleSyncAlert(supabase, SEASON);
    } catch (alertError) {
      console.error("Stale-sync alert could not be evaluated or sent", alertError);
    }
    const summary = await runTrackedSync({
      supabase,
      season: SEASON,
      weeks,
      source: "cron",
    });
    let resultAlert: unknown = null;
    try {
      resultAlert = await checkResultAttentionAlert(supabase, SEASON);
    } catch (alertError) {
      console.error("Result-attention alert could not be evaluated or sent", alertError);
    }
    return Response.json({ ok: true, summary, alerts: { stale: staleAlert, results: resultAlert } });
  } catch (error) {
    console.error("Results sync failed", error);
    try {
      if (weeks.length) await sendSyncFailureAlert(supabase, SEASON, weeks, error);
    } catch (alertError) {
      console.error("Game-day failure alert could not be sent", alertError);
    }
    const message = error instanceof Error ? error.message : "Unknown sync error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
