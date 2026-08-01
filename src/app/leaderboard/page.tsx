"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/leaderboardDb";

type Row = {
  user_id: string;
  display_name: string;
  points: number;
  picks_made: number;
  correct: number;
  upsets: number;
  accuracy: number;
};

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      const data = await getLeaderboard();
      setRows(data ?? []);
    }
    load();
  }, []);

  // Determine Most Upsets
  const maxUpsets =
    rows.length > 0 ? Math.max(...rows.map((r) => r.upsets ?? 0)) : 0;

  const upsetLeaders =
    maxUpsets > 0
      ? rows.filter((r) => r.upsets === maxUpsets)
      : [];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>

      <p className="mt-2 text-sm text-gray-400">
        1 point per pick • +1 correct • +1 upset • playoff rounds multiply
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        <div className="grid grid-cols-14 bg-gray-800 px-4 py-3 text-xs font-semibold text-gray-200">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">User</div>
          <div className="col-span-2 text-right">Points</div>
          <div className="col-span-2 text-right">Correct</div>
          <div className="col-span-2 text-right">Upsets</div>
          <div className="col-span-1 text-right">Picks</div>
          <div className="col-span-2 text-right">Accuracy</div>
        </div>

        {rows.map((r, idx) => {
          const isUpsetLeader =
            maxUpsets > 0 && r.upsets === maxUpsets;

          return (
            <div
              key={r.user_id}
              className={`grid grid-cols-14 px-4 py-3 text-sm text-gray-100 ${
                idx !== rows.length - 1
                  ? "border-b border-gray-800"
                  : ""
              } ${idx < 3 ? "bg-gray-800/40" : "bg-gray-900"}`}
            >
              <div className="col-span-1 font-medium">
                <span className="mr-1">
                  {medalForRank(idx + 1)}
                </span>
                {idx + 1}
              </div>

              <div className="col-span-4 font-medium flex items-center gap-2">
                {r.display_name}
                {isUpsetLeader && (
                  <span className="text-xs bg-emerald-700/30 text-emerald-300 px-2 py-0.5 rounded-full">
                    💥 Most Upsets
                  </span>
                )}
              </div>

              <div className="col-span-2 text-right font-semibold text-blue-400">
                {r.points}
              </div>

              <div className="col-span-2 text-right">
                {r.correct}
              </div>

              <div className="col-span-2 text-right text-emerald-400 font-medium">
                {r.upsets}
              </div>

              <div className="col-span-1 text-right">
                {r.picks_made}
              </div>

              <div className="col-span-2 text-right font-medium">
                {r.picks_made > 0
                  ? `${r.accuracy}%`
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {maxUpsets > 0 && upsetLeaders.length > 1 && (
        <div className="mt-4 text-sm text-gray-400">
          💥 Tie for most upsets:{" "}
          {upsetLeaders.map((u) => u.display_name).join(", ")}
        </div>
      )}
    </main>
  );
}
