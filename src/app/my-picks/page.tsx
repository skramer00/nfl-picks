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
  status?: "scheduled" | "final";
  winner?: string;
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

const dashboard = useMemo(() => {
  const totalGames = allGames.length;
  const picksMade = allGames.filter((g) => Boolean(picks[g.id])).length;

  const finalGames = allGames.filter((g) => g.status === "final" && g.winner);
  const finalPicked = finalGames.filter((g) => Boolean(picks[g.id]));
  const correct = finalPicked.filter((g) => picks[g.id] === g.winner).length;

  const accuracy =
    finalPicked.length > 0 ? Math.round((correct / finalPicked.length) * 1000) / 10 : 0;

  const pctPicked = totalGames > 0 ? Math.round((picksMade / totalGames) * 100) : 0;

  return {
    totalGames,
    picksMade,
    pctPicked,
    finalGamesCount: finalGames.length,
    finalPickedCount: finalPicked.length,
    correct,
    accuracy,
  };
}, [picks]);

  const stats = useMemo(() => {
    const finalGames = allGames.filter((g) => g.status === "final" && g.winner);
    const pickedFinalGames = finalGames.filter((g) => picks[g.id]);

    const correct = pickedFinalGames.filter((g) => picks[g.id] === g.winner).length;
    const total = pickedFinalGames.length;

    const pct = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0; // 1 decimal
    return { correct, total, pct, finalGamesCount: finalGames.length };
  }, [picks]);

  return (
    <main className="mx-auto max-w-4xl p-6">

      <h1 className="mt-4 text-2xl font-semibold">My Picks</h1>

<div className="mt-4 grid gap-4 md:grid-cols-3">
  <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <div className="text-xs text-gray-400">Season accuracy</div>
    <div className="mt-1 text-2xl font-semibold">
      {dashboard.correct}/{dashboard.finalPickedCount}{" "}
      <span className="text-base font-normal text-gray-300">
        ({dashboard.accuracy}%)
      </span>
    </div>
    <div className="mt-1 text-xs text-gray-500">
      Final games available: {dashboard.finalGamesCount}
    </div>
  </div>

  <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <div className="text-xs text-gray-400">Picks made</div>
    <div className="mt-1 text-2xl font-semibold">
      {dashboard.picksMade}/{dashboard.totalGames}{" "}
      <span className="text-base font-normal text-gray-300">
        ({dashboard.pctPicked}%)
      </span>
    </div>

    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-800">
      <div
        className="h-full rounded-full bg-gray-200"
        style={{ width: `${dashboard.pctPicked}%` }}
      />
    </div>

    <div className="mt-2 text-xs text-gray-500">
      Tip: make picks early—everything locks at kickoff later.
    </div>
  </div>

  <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <div className="text-xs text-gray-400">View</div>
    <div className="mt-2 flex gap-2">
      <button
        onClick={() => setViewMode("week")}
        className={`rounded-lg border px-3 py-2 text-sm ${
          viewMode === "week"
            ? "border-gray-200 bg-gray-800 text-white"
            : "border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800"
        }`}
      >
        By Week
      </button>

      <button
        onClick={() => setViewMode("team")}
        className={`rounded-lg border px-3 py-2 text-sm ${
          viewMode === "team"
            ? "border-gray-200 bg-gray-800 text-white"
            : "border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800"
        }`}
      >
        By Team
      </button>
    </div>
  </div>
</div>

      <div className="mt-4 rounded-xl border p-4">
        <div className="text-sm text-gray-600">Season accuracy (final games you picked)</div>
        <div className="mt-1 text-2xl font-semibold">
          {stats.correct} / {stats.total} ({stats.pct}%)
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Final games available: {stats.finalGamesCount} (you’ve picked {stats.total})
        </div>
      </div>

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
               <div key={g.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 text-sm">
<div>
  Week {g.week}: {g.awayTeam} @ {g.homeTeam} —{" "}
  <span className="font-medium">
    {picks[g.id] ? `Picked: ${picks[g.id]}` : "No pick"}
  </span>
</div>

  {g.status === "final" && g.winner && picks[g.id] && (
    <div className="text-lg">
      {picks[g.id] === g.winner ? "✅" : "❌"}
    </div>
  )}
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
{g.status === "final" && g.winner && (
  <span className="ml-2 text-xs text-gray-600">
    • Final: {g.winner} {picks[g.id] ? (picks[g.id] === g.winner ? "✅" : "❌") : ""}
  </span>
)}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </main>
  );
}