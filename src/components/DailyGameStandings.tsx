"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dailyGames, formatGameScore, type DailyGame, type DailyStanding } from "@/lib/dailyGameScores";

export default function DailyGameStandings({ game }: { game: DailyGame }) {
  const [board, setBoard] = useState<{ day: string; rows: DailyStanding[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const { label, rule, column } = dailyGames[game];

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/game-standings?game=${game}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load standings");
        const data = await response.json();
        if (!controller.signal.aborted) setBoard(data);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [game]);

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">{label} daily standings</h2>
      <p className="mt-2 text-gray-300">{rule}</p>
      <p className="mt-1 text-sm text-gray-400">Daily standings reset at midnight Pacific time. Tied scores share a rank.</p>
      <Link className="my-4 inline-block text-amber-300 underline" href={`/${game}`}>Play {label}</Link>
      {board && <p className="mb-2 text-sm text-gray-300">{board.day} · Top 100</p>}
      {!board || !board.rows.length ? (
        <p role="status" className="rounded-xl border border-gray-800 bg-gray-950 p-5 text-gray-300">
          {failed ? "Standings are temporarily unavailable." : board ? "No scores posted today yet." : "Loading standings…"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-300"><tr>
              <th scope="col" className="px-3 py-3 text-left">Rank</th>
              <th scope="col" className="px-3 py-3 text-left">Player</th>
              <th scope="col" className="px-3 py-3 text-right">{column}</th>
            </tr></thead>
            <tbody>{board.rows.map((row, index) => (
              <tr key={index} className="border-t border-gray-800">
                <td className="px-3 py-3">{row.rank}</td>
                <td className="break-words px-3 py-3">{row.name}</td>
                <td className="px-3 py-3 text-right font-semibold text-amber-300">{formatGameScore(game, row.score)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
