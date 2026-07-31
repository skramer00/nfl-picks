import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import { findActiveWeeks } from "@/lib/results/sync";
import { runTrackedSync } from "@/lib/results/runSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEASON = 2026;

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const [{ data: runs, error: runsError }, { data: overrides, error: overridesError }] =
      await Promise.all([
        supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(20),
        supabase
          .from("favorability_overrides")
          .select("game_id, home_win_probability, reason, updated_at"),
      ]);

    if (runsError) throw runsError;
    if (overridesError) throw overridesError;

    return Response.json({
      runs: runs ?? [],
      overrides: overrides ?? [],
      schedule: "Daily at 12:00 UTC (5:00 AM PDT / 4:00 AM PST)",
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { week?: number };
    const requestedWeek = Number(body.week);
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
      source: "manual",
      requestedBy: user.id,
    });
    return Response.json({ ok: true, summary });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
