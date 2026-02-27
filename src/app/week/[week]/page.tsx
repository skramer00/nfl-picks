"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import week1 from "@/data/games_2026_week1.json";
import week2 from "@/data/games_2026_week2.json";
import { loadPicks, setPick, PickMap } from "@/lib/picks";

type Game = {
  id: string;
  week: number;
  kickoffISO: string;
  awayTeam: string;
  homeTeam: string;
};

function isLocked(kickoffISO: string) {
  return Date.now() >= new Date(kickoffISO).getTime();
}

export default function WeekPage() {
  const params = useParams();
  const weekParam = params.week;
  const weekNumber = Number(Array.isArray(weekParam) ? weekParam[0] : weekParam);

const games = useMemo(() => {
  if (weekNumber === 1) return week1 as Game[];
  if (weekNumber === 2) return week2 as Game[];
  return [] as Game[];
}, [weekNumber]);

  const [picks, setPicks] = useState<PickMap>({});

  useEffect(() => {
    setPicks(loadPicks());
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
  ← Back to Home
</Link>
      <h1 className="text-2xl font-semibold">Week {Number.isFinite(weekNumber) ? weekNumber : "?"} Picks</h1>
      <p className="mt-2 text-sm text-gray-600">
        Click a team to pick the winner. Picks lock at kickoff (placeholder logic for now).
      </p>

      <div className="mt-4 flex gap-2">
  <a
    href={`/week/${Math.max(1, weekNumber - 1)}`}
    className="rounded-lg border px-3 py-2 text-sm hover:border-black"
  >
    ← Prev
  </a>
  <a
    href={`/week/${weekNumber + 1}`}
    className="rounded-lg border px-3 py-2 text-sm hover:border-black"
  >
    Next →
  </a>
</div>

      <div className="mt-6 space-y-4">
        {games.length === 0 && (
          <div className="rounded-lg border p-4 text-sm text-gray-600">
            No games loaded for week {Number.isFinite(weekNumber) ? weekNumber : "?"} yet.
          </div>
        )}

        {games.map((g) => {
          const locked = isLocked(g.kickoffISO);
          const picked = picks[g.id];

          return (
            <div key={g.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-600">
                  Kickoff: {new Date(g.kickoffISO).toLocaleString()}
                </div>
                <div className={`text-xs font-medium ${locked ? "text-red-600" : "text-green-700"}`}>
                  {locked ? "Locked" : "Open"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  disabled={locked}
                  onClick={() => setPicks(setPick(g.id, g.awayTeam))}
                  className={`rounded-lg border px-3 py-3 text-left transition ${
                    picked === g.awayTeam ? "border-black" : "border-gray-300"
                  } ${locked ? "opacity-50" : "hover:border-black"}`}
                >
                  <div className="text-xs text-gray-500">Away</div>
                  <div className="text-lg font-semibold">{g.awayTeam}</div>
                  {picked === g.awayTeam && <div className="text-xs text-gray-600">Your pick</div>}
                </button>

                <button
                  disabled={locked}
                  onClick={() => setPicks(setPick(g.id, g.homeTeam))}
                  className={`rounded-lg border px-3 py-3 text-left transition ${
                    picked === g.homeTeam ? "border-black" : "border-gray-300"
                  } ${locked ? "opacity-50" : "hover:border-black"}`}
                >
                  <div className="text-xs text-gray-500">Home</div>
                  <div className="text-lg font-semibold">{g.homeTeam}</div>
                  {picked === g.homeTeam && <div className="text-xs text-gray-600">Your pick</div>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}