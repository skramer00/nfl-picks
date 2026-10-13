"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameRow } from "@/lib/gamesDb";
import { efficiencyExperiment } from "@/lib/modelAnalytics";
import { supabase } from "@/lib/supabaseClient";
import type { Database } from "@/lib/database.types";

export function ModelExperimentPanel({ games, season }: { games: GameRow[]; season: number }) {
  const results = useMemo(() => efficiencyExperiment(games), [games]);
  const [health, setHealth] = useState<Database["public"]["Tables"]["model_data_refreshes"]["Row"] | null>(null);
  const [counts, setCounts] = useState({ efficiency: 0, markets: 0 });
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [marketHealth, setMarketHealth] = useState<Database["public"]["Tables"]["model_data_refreshes"]["Row"] | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("model_data_refreshes").select("*").eq("season", season).eq("source", "nflverse").maybeSingle(),
      supabase.from("model_efficiency_observations").select("game_id", { count: "exact", head: true }).eq("season", season),
      supabase.from("model_market_snapshots").select("game_id", { count: "exact", head: true }).eq("season", season),
      supabase.from("model_data_refreshes").select("*").eq("season", season).eq("source", "espn-market").maybeSingle(),
    ]).then(([source, efficiency, markets, marketSource]) => {
      if (!active) return;
      if (source.error || efficiency.error || markets.error || marketSource.error) { setError(true); return; }
      setHealth(source.data); setCounts({ efficiency: efficiency.count ?? 0, markets: markets.count ?? 0 });
      setMarketHealth(marketSource.data);
      setStale(Boolean(source.data && Date.now() - Date.parse(source.data.attempted_at) > 48 * 3600000));
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [season]);
  const rows = [
    ["Live model · paired with trial", results.live], ["Efficiency trial", results.shadow],
    ["Live model · paired with market", results.marketLive], ["Market at forecast time", results.market],
  ] as const;
  return <section className="mt-6 rounded-2xl border border-blue-900 bg-gray-950 p-5 sm:p-6" aria-label="Efficiency trial and market benchmark">
    <h2 className="text-xl font-semibold">Efficiency trial &amp; market benchmark</h2>
    <p className="mt-2 text-gray-300">The trial uses current-season, opponent-adjusted EPA and success rate. It runs alongside the live model and does not change published picks.</p>
    <p className="mt-2 text-sm text-gray-300">Only final forecasts captured together before kickoff are scored here. Missing odds, ties and unpaired forecasts are excluded. Market prices are observations at forecast time, not guaranteed closing prices.</p>
    {error ? <p className="mt-4 text-amber-200">Collection status is temporarily unavailable.</p> : <p className="mt-4 text-gray-200">
      {counts.efficiency} efficiency observations · {counts.markets} market snapshots · {results.shadowCaptured} trial forecasts.
      {health ? ` Last efficiency refresh: ${new Date(health.attempted_at).toLocaleString("en-US", { timeZone: "UTC" })} UTC (${health.status}).` : " Waiting for first efficiency refresh."}
    </p>}
    {health && (health.status !== "success" || stale) ? <p className="mt-2 text-amber-200">Efficiency collection needs attention; forecasts can only use previously collected observations.</p> : null}
    {marketHealth?.status === "error" ? <p className="mt-2 text-amber-200">Some pregame odds were unavailable on the last collection. Those forecasts are excluded from the market comparison.</p> : null}
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-gray-700 text-gray-300"><th className="p-3">Model</th><th className="p-3">Correct / games</th><th className="p-3">Brier ↓</th><th className="p-3">Log loss ↓</th></tr></thead><tbody>
      {rows.map(([label, metrics]) => <tr key={label} className="border-b border-gray-800"><td className="p-3">{label}</td><td className="p-3">{metrics.correct} / {metrics.count}</td><td className="p-3">{metrics.brier?.toFixed(3) ?? "—"}</td><td className="p-3">{metrics.logLoss?.toFixed(3) ?? "—"}</td></tr>)}
    </tbody></table></div>
    {!results.shadow.count ? <p className="mt-3 text-amber-200">Waiting for paired trial games to finish. Historical games are not counted as new predictions.</p> : null}
    <h3 className="mt-6 font-semibold">Large differences from market</h3>
    <p className="mt-1 text-sm text-gray-300">Review flags start at a 10-point probability difference; they do not override the model. Percentages below are for the home team.</p>
    {results.flags.length ? <ul className="mt-3 space-y-2">{results.flags.map(({ game, model, market, gap }) => <li key={game.id}>W{game.week} {game.away_team.abbreviation} at {game.home_team.abbreviation}: model {(model * 100).toFixed(1)}%, market {(market * 100).toFixed(1)}% · {(gap * 100).toFixed(1)} points apart</li>)}</ul> : <p className="mt-3 text-gray-300">No large differences in available upcoming forecast pairs.</p>}
    <p className="mt-5 text-sm text-gray-400">Efficiency source: <a href="https://nflverse.nflverse.com/" className="underline">nflverse / nflfastR</a> (CC BY 4.0). Regular-season pass/run plays; no kneels, spikes or special teams. Market: ESPN / DraftKings, with the bookmaker margin removed.</p>
  </section>;
}
