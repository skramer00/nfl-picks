import { getGamesByWeek } from "@/lib/gamesDb";
import { pretzelUnderdog } from "@/lib/pretzelEligibility";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^ ]+)$/i)?.[1];
  if (!token) return Response.json({ error: "Log in to save your Pretzel Pick." }, { status: 401 });

  const db = createSupabaseAdmin();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Log in to save your Pretzel Pick." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.gameId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.gameId)) {
    return Response.json({ error: "Choose a valid matchup." }, { status: 400 });
  }

  try {
    const { data: game, error: gameError } = await db.from("games")
      .select("id, season, week, kickoff_at, season_type").eq("id", body.gameId).maybeSingle();
    if (gameError) throw gameError;
    if (!game || game.season_type !== "REG" || game.week < 1 || game.week > 18) {
      return Response.json({ error: "Choose a regular-season matchup." }, { status: 400 });
    }
    if (Date.parse(game.kickoff_at) <= Date.now()) {
      return Response.json({ error: "This game has already kicked off." }, { status: 409 });
    }

    const [{ data: pick, error: pickError }, games] = await Promise.all([
      db.from("picks").select("picked_team_id").eq("user_id", user.id).eq("game_id", game.id).maybeSingle(),
      getGamesByWeek(game.season, game.week),
    ]);
    if (pickError) throw pickError;
    const matchup = games.find(({ id }) => id === game.id);
    const underdog = matchup ? pretzelUnderdog(matchup) : null;
    if (!underdog || pick?.picked_team_id !== underdog) {
      return Response.json({ error: "Save a pick on the current model underdog first. Refresh if the odds changed." }, { status: 409 });
    }

    const { error } = await db.from("pretzel_picks").upsert({
      user_id: user.id,
      season: game.season,
      week: game.week,
      game_id: game.id,
      underdog_team_id: underdog,
    }, { onConflict: "user_id,season,week" });
    if (error?.code === "P0001") return Response.json({ error: error.message }, { status: 409 });
    if (error) throw error;
    return Response.json({ saved: true });
  } catch (error) {
    console.error("Pretzel Pick save failed", error);
    return Response.json({ error: "Unable to save your Pretzel Pick. Try again." }, { status: 503 });
  }
}
