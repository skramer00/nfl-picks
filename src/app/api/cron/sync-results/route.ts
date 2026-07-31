import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findActiveWeeks, syncResults } from "@/lib/results/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEASON = 2026;

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

    const summary = await syncResults({ supabase, season: SEASON, weeks });
    return Response.json({ ok: true, summary });
  } catch (error) {
    console.error("Results sync failed", error);
    const message = error instanceof Error ? error.message : "Unknown sync error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
