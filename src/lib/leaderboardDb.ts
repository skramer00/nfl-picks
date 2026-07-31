import { supabase } from "./supabaseClient";

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  points: number;
  picks_made: number;
  correct: number;
  upsets: number;
  final_picks: number;
  accuracy: number; // percent, 1 decimal (e.g., 62.5)
};

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard_points")
    .select(
      "user_id, display_name, points, picks_made, correct, upsets, final_picks, accuracy"
    )
    .order("points", { ascending: false })
    .order("accuracy", { ascending: false })
    .order("picks_made", { ascending: false });

  if (error) {
    console.error("Leaderboard error:", error);
    return [];
  }

  return (data ?? []) as LeaderboardRow[];
}