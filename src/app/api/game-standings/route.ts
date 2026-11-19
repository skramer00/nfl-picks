import { dailySeed, restoreDuel, roster, score } from "@/lib/draftDuel";
import { rescueDailySeed, restoreRescue, solvePuzzle, total } from "@/lib/rosterRescue";
import { isDailyGame, rescueScore, type DailyGame, type DailyStanding } from "@/lib/dailyGameScores";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

function today(game: DailyGame) {
  return (game === "draft-duel" ? dailySeed(new Date()) : rescueDailySeed(new Date())).slice(-10);
}

export async function GET(request: Request) {
  const game = new URL(request.url).searchParams.get("game");
  if (!isDailyGame(game)) return Response.json({ error: "Choose a game." }, { status: 400 });

  const day = today(game);
  const { data, error } = await createSupabaseAdmin()
    .from("daily_game_scores")
    .select("score, profiles(display_name)")
    .eq("game", game)
    .eq("day", day)
    .order("score", { ascending: false })
    .order("user_id")
    .limit(100);

  if (error) {
    console.error("Daily standings query failed", error.code);
    return Response.json({ error: "Standings are temporarily unavailable." }, { status: 503 });
  }

  let rank = 0;
  const rows: DailyStanding[] = data.map((row, index) => {
    if (index === 0 || row.score !== data[index - 1].score) rank = index + 1;
    return { rank, name: row.profiles?.display_name ?? "Player", score: row.score };
  });
  return Response.json({ day, rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^ ]+)$/i)?.[1];
  if (!token) return Response.json({ error: "Sign in to post your score." }, { status: 401 });

  const db = createSupabaseAdmin();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Sign in to post your score." }, { status: 401 });

  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "Result is too large." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid result." }, { status: 400 });
  }
  const { game, result } = body ?? {};
  if (!isDailyGame(game) || result?.mode !== "daily") {
    return Response.json({ error: "Choose a completed daily game." }, { status: 400 });
  }

  const day = today(game);
  if (result.seed !== (game === "draft-duel" ? `daily-v2-${day}` : `rescue-v2-daily-${day}`)) {
    return Response.json({ error: "The daily board has rolled over. Play today’s challenge to post a score." }, { status: 409 });
  }

  let points: number;
  if (game === "draft-duel") {
    const duel = restoreDuel(result);
    if (duel?.picks.length !== 18) return Response.json({ error: "Complete a valid draft first." }, { status: 400 });
    points = Math.round((score(roster(duel, "you")) - score(roster(duel, "cpu"))) * 100);
  } else {
    const rescue = restoreRescue(result);
    if (!rescue?.save.submitted) return Response.json({ error: "Lock in a valid rescue first." }, { status: 400 });
    const baseline = total(rescue.puzzle.starters);
    points = rescueScore(total(rescue.cards) - baseline, total(solvePuzzle(rescue.puzzle)) - baseline);
  }

  const { error } = await db.from("daily_game_scores").insert({ user_id: user.id, game, day, score: points });
  if (error?.code === "23505") return Response.json({ alreadyPosted: true });
  if (error) {
    console.error("Daily score save failed", error.code);
    return Response.json({ error: "Your result couldn’t be posted. Try again." }, { status: 503 });
  }
  return Response.json({ alreadyPosted: false });
}
