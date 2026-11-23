import { supabase } from "./supabaseClient";

type PickSelection = {
  game_id: string;
  picked_team_id: string;
};

export async function getUserPicks(knownUserId?: string): Promise<Record<string, string>> {
  let userId = knownUserId;
  if (!userId) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError?.name === "AuthSessionMissingError") return {};
    if (userError) throw userError;
    if (!user) return {};
    userId = user.id;
  }

  const { data, error } = await supabase
    .from("picks")
    .select("game_id, picked_team_id")
    .eq("user_id", userId);

  if (error) throw error;

  return ((data ?? []) as unknown as PickSelection[]).reduce<Record<string, string>>(
    (picks, pick) => {
      picks[pick.game_id] = pick.picked_team_id;
      return picks;
    },
    {}
  );
}

export async function upsertPick(gameId: string, teamId: string) {
  const { error } = await supabase.rpc("submit_pick", {
    p_game_id: gameId,
    p_team_id: teamId,
  });

  if (error) throw error;
}

export async function getPretzelPicks(season: number, userId: string) {
  const { data, error } = await supabase.from("pretzel_picks")
    .select("week, game_id").eq("season", season).eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries(data.map(({ week, game_id }) => [week, game_id]));
}

export async function savePretzelPick(userId: string, season: number, week: number, gameId: string, remove: boolean) {
  if (remove) {
    const { error } = await supabase.from("pretzel_picks").delete()
      .eq("user_id", userId).eq("season", season).eq("week", week).eq("game_id", gameId);
    if (error) throw new Error(error.message);
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) throw new Error("Log in to save your Pretzel Pick.");
  const response = await fetch("/api/pretzel-pick", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ gameId }),
  });
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({}));
    throw new Error(error ?? "Unable to save your Pretzel Pick.");
  }
}
