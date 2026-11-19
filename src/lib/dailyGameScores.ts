export type DailyGame = "draft-duel" | "roster-rescue";

export const dailyGames = {
  "draft-duel": {
    label: "Draft Duel",
    rule: "Your roster total minus the computer’s. A positive margin is a win. Higher margins rank first.",
    column: "Margin",
  },
  "roster-rescue": {
    label: "Roster Rescue",
    rule: "Your improvement divided by the best possible improvement in up to three swaps. A perfect rescue earns 100%.",
    column: "Rescue score",
  },
};

export type DailyStanding = { rank: number; name: string; score: number };

export function isDailyGame(value: unknown): value is DailyGame {
  return value === "draft-duel" || value === "roster-rescue";
}

export function rescueScore(gain: number, bestGain: number) {
  const possible = Math.round(bestGain * 100);
  if (possible <= 0) return 10000;
  return Math.max(0, Math.min(10000, Math.floor(Math.round(gain * 100) * 10000 / possible)));
}

export function formatGameScore(game: DailyGame, score: number) {
  const value = (score / 100).toFixed(2);
  return game === "roster-rescue" ? `${value}%` : `${score > 0 ? "+" : ""}${value}`;
}
