"use client";

const TEAM_COLORS: Record<string, string> = {
  LAC: "bg-blue-600 text-white border-blue-600",
  KC: "bg-red-600 text-white border-red-600",
  BUF: "bg-blue-700 text-white border-blue-700",
  DEN: "bg-orange-600 text-white border-orange-600",
  SF: "bg-red-700 text-white border-red-700",
  SEA: "bg-emerald-600 text-white border-emerald-600",
  NYJ: "bg-green-700 text-white border-green-700",
  MIA: "bg-teal-600 text-white border-teal-600",
  DAL: "bg-slate-700 text-white border-slate-700",
  PHI: "bg-green-800 text-white border-green-800",
};

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

      <div className="mt-5 space-y-3">
        {games.length === 0 && (
          <div className="rounded-lg border p-4 text-sm text-gray-600">
            No games loaded for week {Number.isFinite(weekNumber) ? weekNumber : "?"} yet.
          </div>
        )}

        {games.map((g) => {
          const locked = isLocked(g.kickoffISO);
          const picked = picks[g.id];

          return (
            <div key={g.id} className="rounded-xl border p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-500">
                  Kickoff: {new Date(g.kickoffISO).toLocaleString()}
                </div>
                <div className={`text-xs font-medium ${locked ? "text-red-600" : "text-green-700"}`}>
                  {locked ? "Locked" : "Open"}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  disabled={locked}
                  onClick={() => setPicks(setPick(g.id, g.awayTeam))}
                  className={`rounded-lg border px-3 py-1.5 text-left transition-colors duration-150 ${
  picked === g.awayTeam
    ? TEAM_COLORS[g.awayTeam] ?? "border-white bg-gray-800 text-white"
    : "border-gray-700 bg-gray-900 hover:bg-gray-800"
} ${locked ? "opacity-50 cursor-not-allowed hover:bg-gray-900" : ""}`}
                >
                  <div className="text-xs text-gray-500">Away</div>
                  <div className="text-base font-semibold">{g.awayTeam}</div>
                  {picked === g.awayTeam && <div className="mt-1 text-[11px] opacity-80">Your pick</div>}
                </button>

                <button
                  disabled={locked}
                  onClick={() => setPicks(setPick(g.id, g.homeTeam))}
                  className={`rounded-lg border px-3 py-1.5 text-left transition-colors duration-150 ${
  picked === g.homeTeam
    ? TEAM_COLORS[g.homeTeam] ?? "border-white bg-gray-800 text-white"
    : "border-gray-700 bg-gray-900 hover:bg-gray-800"
} ${locked ? "opacity-50 cursor-not-allowed hover:bg-gray-900" : ""}`}
                >
                  <div className="text-xs text-gray-500">Home</div>
                  <div className="text-base font-semibold">{g.homeTeam}</div>
                  {picked === g.homeTeam && <div className="mt-1 text-[11px] opacity-80">Your pick</div>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}