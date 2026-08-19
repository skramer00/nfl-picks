"use client";

import { useEffect, useMemo, useState } from "react";
import { ShareImageButton } from "@/components/ShareImageButton";
import type { GameRow } from "@/lib/gamesDb";
import type { LeaderboardRow } from "@/lib/leaderboardDb";
import { getMyPools, getPoolStandings, type Pool } from "@/lib/poolsDb";
import { supabase } from "@/lib/supabaseClient";
import { buildWeeklyRecap } from "@/lib/weeklyRecap";

type PoolContext = { rank: number | null; movement: number; winner: string | null };

function cumulativeRank(weeks: LeaderboardRow[][], userId: string) {
  const totals = new Map<string, { name: string; points: number }>();
  for (const rows of weeks) for (const row of rows) {
    const current = totals.get(row.user_id) ?? { name: row.display_name, points: 0 };
    current.points += row.points;
    totals.set(row.user_id, current);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1].points - a[1].points || a[1].name.localeCompare(b[1].name));
  const index = ranked.findIndex(([id]) => id === userId);
  return index >= 0 ? index + 1 : null;
}

export function SeasonRecap({ games, picks, userId }: { games: GameRow[]; picks: Record<string, string>; userId: string }) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [poolId, setPoolId] = useState("");
  const [week, setWeek] = useState(() => {
    const completed = games.filter((game) => game.status === "final");
    return completed.length ? Math.max(...completed.map((game) => game.week)) : 1;
  });
  const [displayName, setDisplayName] = useState("Pretzel Quest player");
  const [poolContext, setPoolContext] = useState<PoolContext | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const [userPools, profile] = await Promise.all([
          getMyPools(),
          supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
        ]);
        if (cancelled) return;
        setPools(userPools);
        setDisplayName(profile.data?.display_name || "Pretzel Quest player");
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load recap details.");
      }
    }
    void loadContext();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!poolId) return;
    let cancelled = false;
    async function loadPool() {
      try {
        const allWeeks = await Promise.all(Array.from({ length: week }, (_, index) => getPoolStandings(poolId, index + 1)));
        if (cancelled) return;
        const rank = cumulativeRank(allWeeks, userId);
        const previousRank = week > 1 ? cumulativeRank(allWeeks.slice(0, -1), userId) : rank;
        const currentWeek = allWeeks.at(-1) ?? [];
        setPoolContext({ rank, movement: rank && previousRank ? previousRank - rank : 0, winner: currentWeek[0]?.points > 0 ? currentWeek[0].display_name : null });
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load pool recap.");
      }
    }
    void loadPool();
    return () => { cancelled = true; };
  }, [poolId, userId, week]);

  const recap = useMemo(() => buildWeeklyRecap(games, picks, week), [games, picks, week]);
  const selectedPool = pools.find((pool) => pool.pool_id === poolId);
  const imageUrl = `/api/share/recap?${new URLSearchParams({
    name: displayName, week: String(week), correct: String(recap.correct), total: String(recap.finalPicks),
    points: String(recap.points), agreement: recap.agreement === null ? "—" : `${recap.agreement}%`,
    best: recap.bestUpset?.team ?? "No upset pick", pool: selectedPool?.name ?? "", rank: poolContext?.rank ? `#${poolContext.rank}` : "",
  }).toString()}`;

  return <section className="mt-6">
    <div className="max-w-3xl"><p className="text-sm font-medium uppercase tracking-widest text-amber-400">🥨 Weekly rewind</p><h2 className="mt-1 text-2xl font-semibold">Weekly Recap</h2><p className="mt-2 text-gray-400">Your weekly scorecard, model comparison, and pool results.</p></div>
    {error ? <div className="mt-5 rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-200">{error}</div> : null}
    <div className="mt-6 flex flex-wrap items-end gap-3">
      <label className="text-sm text-gray-300">Week<select value={week} onChange={(event) => setWeek(Number(event.target.value))} className="mt-1 block rounded-xl border border-gray-700 bg-gray-950 px-5 py-3 text-white">{Array.from({ length: 18 }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}</select></label>
      {pools.length ? <label className="min-w-56 text-sm text-gray-300">Pool<select value={poolId} onChange={(event) => { setPoolId(event.target.value); if (!event.target.value) setPoolContext(null); }} className="mt-1 block w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white"><option value="">No pool</option>{pools.map((pool) => <option key={pool.pool_id} value={pool.pool_id}>{pool.name}</option>)}</select></label> : null}
      {recap.finalPicks ? <ShareImageButton imageUrl={imageUrl} fileName={`pretzel-quest-week-${week}-recap.png`} label="Share recap" /> : null}
    </div>
    {!recap.finalPicks ? <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-6"><h3 className="text-xl font-semibold">Week {week} recap isn’t ready yet</h3><p className="mt-2 text-sm text-gray-400">It will appear after at least one game is final and you have a pick for it. {recap.pending} game{recap.pending === 1 ? " is" : "s are"} still awaiting a result.</p></div> : <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Record", `${recap.correct}-${recap.finalPicks - recap.correct}`, `${recap.accuracy}% correct`],
        ["Points", String(recap.points), "Pick + correct bonuses"],
        ["Model agreement", `${recap.agreement}%`, "Same side as the model"],
        ["Games remaining", String(recap.pending), "Updates as results arrive"],
      ].map(([label, value, note]) => <div key={label} className="rounded-2xl border border-gray-800 bg-gray-950 p-5"><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-gray-400">{note}</p></div>)}</div>
      <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5"><p className="text-xs uppercase tracking-wider text-emerald-400">Best upset</p>{recap.bestUpset ? <><h3 className="mt-2 text-xl font-semibold">{recap.bestUpset.team}</h3><p className="mt-1 text-sm text-gray-300">Won as a {recap.bestUpset.probability}% model underdog over {recap.bestUpset.opponent}.</p></> : <p className="mt-2 text-sm text-gray-400">No correct underdog pick this week.</p>}</div><div className="rounded-2xl border border-rose-900 bg-rose-950/20 p-5"><p className="text-xs uppercase tracking-wider text-rose-400">Biggest miss</p>{recap.biggestMiss ? <><h3 className="mt-2 text-xl font-semibold">{recap.biggestMiss.team}</h3><p className="mt-1 text-sm text-gray-300">Your {recap.biggestMiss.probability}% side lost to {recap.biggestMiss.winner}.</p></> : <p className="mt-2 text-sm text-gray-400">No misses—clean card so far.</p>}</div></div>
      {selectedPool && poolContext ? <div className="mt-6 rounded-2xl border border-blue-900 bg-blue-950/20 p-5"><p className="text-xs uppercase tracking-wider text-blue-400">{selectedPool.name}</p><div className="mt-3 grid gap-4 sm:grid-cols-3"><div><p className="text-sm text-gray-400">Season rank</p><p className="text-2xl font-bold">{poolContext.rank ? `#${poolContext.rank}` : "—"}</p></div><div><p className="text-sm text-gray-400">Movement</p><p className="text-2xl font-bold">{poolContext.movement > 0 ? `▲ ${poolContext.movement}` : poolContext.movement < 0 ? `▼ ${Math.abs(poolContext.movement)}` : "—"}</p></div><div><p className="text-sm text-gray-400">Weekly leader</p><p className="text-lg font-semibold">{poolContext.winner ?? "Pending"}</p></div></div></div> : null}
    </>}
  </section>;
}
