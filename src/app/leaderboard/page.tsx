"use client";

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import week1 from "@/data/games_2026_week1.json";
import week2 from "@/data/games_2026_week2.json";
import { fakeUsers, FakeUser } from "@/data/fakeUsers";
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

const allGames: Game[] = [...(week1 as Game[]), ...(week2 as Game[])];

function computeStats(picks: Record<string, string>, games: Game[]) {
  const finalGames = games.filter((g) => g.status === "final" && g.winner);

  const pickedFinalGames = finalGames.filter((g) => Boolean(picks[g.id]));
  const correct = pickedFinalGames.filter((g) => picks[g.id] === g.winner).length;
  const total = pickedFinalGames.length;

  const pct = total > 0 ? correct / total : 0;

  return { correct, total, pct, finalGamesCount: finalGames.length };
}

export default function LeaderboardPage() {
  const [myPicks, setMyPicks] = useState<PickMap>({});
  const [weekFilter, setWeekFilter] = useState<"season" | number>("season");

  useEffect(() => {
    setMyPicks(loadPicks());
  }, []);

  const filteredGames = useMemo(() => {
    return weekFilter === "season"
      ? allGames
      : allGames.filter((g) => g.week === weekFilter);
  }, [weekFilter]);

  const rows = useMemo(() => {
    const users: FakeUser[] = fakeUsers.map((u) =>
      u.id === "u_scott" ? { ...u, picks: myPicks } : u
    );

    const computed = users.map((u) => {
      const s = computeStats(u.picks, filteredGames);
      return { id: u.id, name: u.name, ...s };
    });

    // Original sorting (simple):
    // 1) Higher pct
    // 2) Higher total (more picks counted)
    // 3) Higher correct
    return computed.sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.total !== a.total) return b.total - a.total;
      return b.correct - a.correct;
    });
  }, [myPicks, filteredGames]);

  const finalGamesCount = filteredGames.filter((g) => g.status === "final" && g.winner).length;

  return (
    <main className="mx-auto max-w-4xl p-6">

      <h1 className="mt-4 text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-2 text-sm text-gray-400">
        Ranked by accuracy on final games picked. Final games available: {finalGamesCount}.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="text-sm text-gray-300">View:</div>
        <select
          value={weekFilter}
          onChange={(e) =>
            setWeekFilter(e.target.value === "season" ? "season" : Number(e.target.value))
          }
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        >
          <option value="season">Season</option>
          <option value="1">Week 1</option>
          <option value="2">Week 2</option>
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        <div className="grid grid-cols-12 bg-gray-800 px-4 py-3 text-xs font-semibold text-gray-200">
          <div className="col-span-1">Rank</div>
          <div className="col-span-5">User</div>
          <div className="col-span-2 text-right">Correct</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-2 text-right">Accuracy</div>
        </div>

          {rows.map((r, idx) => {
  const pctText = r.total > 0 ? `${Math.round(r.pct * 1000) / 10}%` : "—";
  const isMe = r.id === "u_scott";
  const isTop3 = idx < 3;

  return (
    <div
      key={r.id}
      className={`grid grid-cols-12 px-4 py-3 text-sm text-gray-100 ${
        idx !== rows.length - 1 ? "border-b border-gray-800" : ""
      } ${
        isMe
          ? "bg-yellow-900/30"
          : isTop3
          ? "bg-gray-800/40"
          : "bg-gray-900"
      }`}
    >
      <div className="col-span-1 font-medium">
        <span className="mr-1">{medalForRank(idx + 1)}</span>
        {idx + 1}
      </div>

      <div className="col-span-5">
        <div className="font-medium">
          {r.name} {isMe ? "(You)" : ""}
        </div>
      </div>

      <div className="col-span-2 text-right">{r.correct}</div>
      <div className="col-span-2 text-right">{r.total}</div>
      <div className="col-span-2 text-right font-medium">{pctText}</div>
    </div>
  );
})}
      </div>

      <div className="mt-4 text-xs text-gray-400">
        Note: This is a local prototype with a few fake users. When we add Supabase, this becomes real.
      </div>
    </main>
  );
}