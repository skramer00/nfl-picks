import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin(request);
    const body = (await request.json()) as {
      gameId?: string;
      homeWinProbability?: number;
      reason?: string;
    };
    const probability = Number(body.homeWinProbability);
    const reason = body.reason?.trim() ?? "";

    if (!body.gameId || !Number.isFinite(probability) || probability < 0.25 || probability > 0.75) {
      return Response.json({ error: "Choose a home favorability from 25% to 75%." }, { status: 400 });
    }
    if (reason.length < 3 || reason.length > 240) {
      return Response.json({ error: "Add a reason between 3 and 240 characters." }, { status: 400 });
    }

    const { error } = await supabase.from("favorability_overrides").upsert({
      game_id: body.gameId,
      home_win_probability: probability,
      reason,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const gameId = new URL(request.url).searchParams.get("gameId");
    if (!gameId) return Response.json({ error: "Missing game ID." }, { status: 400 });

    const { error } = await supabase.from("favorability_overrides").delete().eq("game_id", gameId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
