import { supabase } from "./supabaseClient";

type PickSelection = {
  game_id: string;
  picked_team_id: string;
};

export async function getUserPicks(): Promise<Record<string, string>> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return {};

  const { data, error } = await supabase
    .from("picks")
    .select("game_id, picked_team_id")
    .eq("user_id", user.id);

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
