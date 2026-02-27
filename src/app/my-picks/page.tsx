"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import week1 from "@/data/games_2026_week1.json";
import week2 from "@/data/games_2026_week2.json";
import { loadPicks, PickMap } from "@/lib/picks";

type Game = {
  id: string;
  week: number;
  kickoffISO: string;
  awayTeam: string;
  homeTeam: string;
};

const allGames: Game[] = [
  ...(week1 as Game[]),
  ...(week2 as Game[])
];

export default function MyPicksPage() {
  const [picks, setPicks] = useState<PickMap>({});
  const [viewMode, setViewMode] = useState<"week" | "team">("week");

  useEffect(() => {
    setPicks(loadPicks());
  }, []);

  const groupedByWeek = useMemo(() => {
    const grouped: Record<number, Game[]> = {};
    for (const game of allGames) {
      if (!grouped[game.week]) grouped[game.week] = [];
      grouped[game.week].push(game);
    }
    return grouped;
  }, []);

  const groupedByTeam = useMemo(() => {
    const grouped: Record<string, Game[]> = {};
    for (const game of allGames) {
      const teams = [game.homeTeam, game.awayTeam];
      for (const team of teams) {
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(game);
      }
    }
    return grouped;
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Back to Home
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">My Picks</h1>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setViewMode("week")}
          className={`rounded-lg border px-3 py-2 text-sm ${
            viewMode === "week" ? "border-black" : "border-gray-300"
          }`}
        >
          By Week
        </button>

        <button
          onClick={() => setViewMode("team")}
          className={`rounded-lg border px-3 py-2 text-sm ${
            viewMode === "team" ? "border-black" : "border-gray-300"
          }`}
        >
          By Team
        </button>
      </div>

      <div className="mt-6 space-y-6">
        {viewMode === "week" &&
          Object.entries(groupedByWeek).map(([week, games]) => (
            <div key={week}>
              <h2 className="mb-2 text-lg font-semibold">Week {week}</h2>
              <div className="space-y-2">
                {games.map((g) => (
                  <div key={g.id} className="rounded border p-3 text-sm">
                    {g.awayTeam} @ {g.homeTeam} —{" "}
                    <span className="font-medium">
                      {picks[g.id] ? `Picked: ${picks[g.id]}` : "No pick"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {viewMode === "team" &&
          Object.entries(groupedByTeam).map(([team, games]) => (
            <div key={team}>
              <h2 className="mb-2 text-lg font-semibold">{team}</h2>
              <div className="space-y-2">
                {games.map((g) => (
                  <div key={g.id} className="rounded border p-3 text-sm">
                    Week {g.week}: {g.awayTeam} @ {g.homeTeam} —{" "}
                    <span className="font-medium">
                      {picks[g.id] ? `Picked: ${picks[g.id]}` : "No pick"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </main>
  );
}