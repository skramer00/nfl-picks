import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
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

  try {
    const supabase = createSupabaseAdmin();
    const requestedWeek = Number(new URL(request.url).searchParams.get("week"));
    const weeks = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 18
      ? [requestedWeek]
      : await findActiveWeeks(supabase, SEASON);

    if (weeks.length === 0) {
      return Response.json({ ok: true, message: "No games are in the active sync window.", weeks });
    }

    const summary = await runTrackedSync({
      supabase,
      season: SEASON,
      weeks,
      source: "cron",
    });
    return Response.json({ ok: true, summary });
  } catch (error) {
    console.error("Results sync failed", error);
    const message = error instanceof Error ? error.message : "Unknown sync error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
