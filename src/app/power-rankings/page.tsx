"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getGamesBySeason, type GameRow } from "@/lib/gamesDb";
import { getUserPicks } from "@/lib/picksDb";
import {
  confidenceCalibration,
  modelPerformance,
  pickDisagreements,
  userPickPerformance,
} from "@/lib/modelAnalytics";
import { buildPowerRankings, type PowerRanking } from "@/lib/powerRankings";
import { supabase } from "@/lib/supabaseClient";
import { getTeamTheme } from "@/lib/teamColors";

const SEASON = 2026;
type ConferenceFilter = "All" | "AFC" | "NFC";

function record(team: PowerRanking) {
  return team.ties
    ? `${team.wins}-${team.losses}-${team.ties}`
    : `${team.wins}-${team.losses}`;
}

function Movement({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-600">—</span>;
  const up = value > 0;
  return (
    <span className={up ? "text-emerald-400" : "text-rose-400"}>
      {up ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

function LeaderCard({ team }: { team: PowerRanking }) {
  const theme = getTeamTheme(team.abbreviation);
  return (
    <article
      className="relative overflow-hidden rounded-2xl border bg-gray-950 p-5"
      style={{ borderColor: theme.accent }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: theme.primary }}
      />
      <div className="flex items-center justify-between">
        <span className="text-4xl font-black text-gray-700">{team.rank}</span>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white"
          style={{ backgroundColor: theme.primary }}
        >
          {team.abbreviation}
        </div>
      </div>
      <h2 className="mt-4 text-xl font-semibold">{team.name}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {team.conference} {team.division} · {record(team)}
      </p>
      <div className="mt-5 flex items-end justify-between border-t border-gray-800 pt-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Model rating</div>
          <div className="mt-1 text-2xl font-bold">{team.rating}</div>
        </div>
        <Movement value={team.movement} />
      </div>
    </article>
  );
}

function AnalyticsCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{detail}</p>
    </div>
  );
}

export default function PowerRankingsPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<ConferenceFilter>("All");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rows, userResult] = await Promise.all([
          getGamesBySeason(SEASON),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;
        setGames(rows);
        if (userResult.data.user) {
          setSignedIn(true);
          const saved = await getUserPicks(userResult.data.user.id);
          if (!cancelled) setPicks(saved);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to build the power rankings."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rankings = useMemo(() => buildPowerRankings(games), [games]);
  const filteredRankings = useMemo(
    () =>
      filter === "All"
        ? rankings
        : rankings.filter((team) => team.conference === filter),
    [filter, rankings]
  );
  const completedGames = useMemo(
    () => games.filter((game) => game.status === "final"),
    [games]
  );
  const latestWeek = completedGames.length
    ? Math.max(...completedGames.map((game) => game.week))
    : null;
  const performance = useMemo(() => modelPerformance(games), [games]);
  const lockedPredictions = useMemo(
    () => games.filter((game) => game.prediction_snapshot_is_pregame).length,
    [games]
  );
  const calibration = useMemo(() => confidenceCalibration(games), [games]);
  const pickPerformance = useMemo(
    () => userPickPerformance(games, picks),
    [games, picks]
  );
  const disagreements = useMemo(
    () => pickDisagreements(games, picks).slice(0, 5),
    [games, picks]
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
          {SEASON} model
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Model Center</h1>
        <p className="mt-3 text-gray-400">
          Power rankings, projections, and a transparent scorecard for how the model performs throughout the season.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Model scorecard">
        <AnalyticsCard label="Model accuracy" value={performance.accuracy === null ? "—" : `${performance.accuracy}%`} detail={performance.finals ? `${performance.correct} of ${performance.finals} final games` : performance.unscoredFinals ? `${performance.unscoredFinals} final games excluded without a pregame snapshot` : "Starts after the first final game"} />
        <AnalyticsCard label="Favorites" value={performance.finals ? String(performance.favoriteWins) : "—"} detail="Model favorites that won" />
        <AnalyticsCard label="Underdog wins" value={performance.finals ? String(performance.underdogWins) : "—"} detail="Games where the model favorite lost" />
      </section>

      <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-400">
        <span className="font-semibold text-gray-200">Pregame archive: </span>
        {lockedPredictions} of {games.length || 272} predictions locked. Snapshots are captured as kickoff approaches, and only verified pregame snapshots count toward model accuracy.
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Detailed model analytics">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Weekly scorecard</p>
          <h2 className="mt-1 text-xl font-semibold">Accuracy by week</h2>
          {performance.weekly.length ? (
            <div className="mt-5 space-y-4">
              {performance.weekly.map((week) => {
                const accuracy = Math.round((week.correct / week.total) * 100);
                return (
                  <div key={week.week}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium">Week {week.week}</span>
                      <span className="text-gray-400">{week.correct}/{week.total} · {accuracy}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${accuracy}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-gray-400">Weekly results will appear as games become final.</p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Confidence check</p>
            <h2 className="mt-1 text-xl font-semibold">Is the model calibrated?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">Compare how confident the model was with how often its favorite actually won.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem_4.5rem] gap-2 border-y border-gray-800 px-4 py-3 text-xs uppercase tracking-wider text-gray-500 sm:px-6">
            <span>Edge</span><span className="text-right">Games</span><span className="text-right">Expected</span><span className="text-right">Actual</span>
          </div>
          {calibration.map((bucket) => (
            <div key={bucket.label} className="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem_4.5rem] gap-2 border-b border-gray-900 px-4 py-3 text-sm last:border-0 sm:px-6">
              <span className="font-medium">{bucket.label}</span>
              <span className="text-right text-gray-400">{bucket.games || "—"}</span>
              <span className="text-right text-gray-400">{bucket.averageConfidence === null ? "—" : `${bucket.averageConfidence}%`}</span>
              <span className="text-right font-semibold">{bucket.accuracy === null ? "—" : `${bucket.accuracy}%`}</span>
            </div>
          ))}
        </div>
      </section>

      {signedIn ? (
        <section className="mt-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Your pick analytics</p>
            <h2 className="mt-1 text-xl font-semibold">How your decisions are performing</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <AnalyticsCard label="Overall accuracy" value={pickPerformance.accuracy === null ? "—" : `${pickPerformance.accuracy}%`} detail={pickPerformance.picks ? `${pickPerformance.correct} of ${pickPerformance.picks} final picks` : "Starts after one of your picks is final"} />
            <AnalyticsCard label="Following the model" value={pickPerformance.withModel.accuracy === null ? "—" : `${pickPerformance.withModel.accuracy}%`} detail={`${pickPerformance.withModel.correct} of ${pickPerformance.withModel.picks} final picks`} />
            <AnalyticsCard label="Going contrarian" value={pickPerformance.againstModel.accuracy === null ? "—" : `${pickPerformance.againstModel.accuracy}%`} detail={`${pickPerformance.againstModel.correct} of ${pickPerformance.againstModel.picks} final picks`} />
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Your pick analytics</p>
          <h2 className="mt-1 text-xl font-semibold">See where you outperform the model</h2>
          <p className="mt-2 text-sm text-gray-400">Log in to compare your accuracy when following the favorite versus making a contrarian pick.</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-blue-300 hover:underline">Log in to compare →</Link>
        </section>
      )}

      {signedIn ? (
        <section className="mt-8 rounded-2xl border border-amber-900/60 bg-amber-950/15 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Your contrarian board</p>
              <h2 className="mt-1 text-xl font-semibold">Biggest disagreements with the model</h2>
            </div>
            <span className="text-xs text-gray-500">Your saved picks only</span>
          </div>
          {disagreements.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">
            {disagreements.map(({ game, favorite, pickedTeamId }) => {
              const picked = pickedTeamId === game.home_team_id ? game.home_team : game.away_team;
              return (
                <Link key={game.id} href={`/week/${game.week}`} className="rounded-xl border border-gray-800 bg-black/30 p-4 hover:border-amber-700">
                  <p className="text-xs text-gray-500">Week {game.week} · {game.away_team.abbreviation} at {game.home_team.abbreviation}</p>
                  <p className="mt-2 text-sm"><span className="font-semibold text-amber-300">You: {picked.name}</span><span className="text-gray-500"> · </span>Model: {favorite.team.name} ({Math.round(favorite.probability * 100)}%)</p>
                </Link>
              );
            })}
          </div> : <p className="mt-4 text-sm text-gray-400">No upcoming disagreements yet. Your contrarian picks will appear here automatically.</p>}
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-gray-800 bg-gray-950 p-1">
          {(["All", "AFC", "NFC"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={`rounded-lg px-4 py-2 text-sm ${
                filter === option
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {!loading && !error ? (
          <p className="text-sm text-gray-500">
            {latestWeek
              ? `Updated through Week ${latestWeek} · ${completedGames.length} final games`
              : "Preseason snapshot · updates after final games"}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-300" role="status">
          Building the power rankings…
        </div>
      ) : null}
      {error ? (
        <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200" role="alert">
          <h2 className="font-semibold">Unable to load power rankings</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : null}
      {!loading && !error && rankings.length === 0 ? (
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-300">
          No team data is available yet.
        </div>
      ) : null}

      {!loading && !error && rankings.length > 0 ? (
        <>
          {filter === "All" ? (
            <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Top three teams">
              {rankings.slice(0, 3).map((team) => (
                <LeaderCard key={team.id} team={team} />
              ))}
            </section>
          ) : null}

          <section className="mt-8 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] gap-3 border-b border-gray-800 px-4 py-3 text-xs uppercase tracking-wider text-gray-500 sm:grid-cols-[3rem_minmax(0,1fr)_6rem_6rem_5rem]">
              <span>Rank</span>
              <span>Team</span>
              <span className="hidden sm:block">Record</span>
              <span className="hidden sm:block">Rating</span>
              <span className="text-right">Move</span>
            </div>
            {filteredRankings.map((team) => {
              const theme = getTeamTheme(team.abbreviation);
              return (
                <div
                  key={team.id}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-3 border-b border-gray-900 px-4 py-4 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_6rem_6rem_5rem]"
                >
                  <span className="text-lg font-bold text-gray-400">{team.rank}</span>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {team.abbreviation}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/power-rankings/${team.abbreviation.toLowerCase()}`} className="truncate font-semibold hover:text-blue-300 hover:underline">{team.name}</Link>
                      <div className="text-xs text-gray-500 sm:hidden">
                        {record(team)} · {team.rating}
                      </div>
                      <div className="hidden text-xs text-gray-500 sm:block">
                        {team.conference} {team.division}
                      </div>
                    </div>
                  </div>
                  <span className="hidden text-sm text-gray-300 sm:block">{record(team)}</span>
                  <span className="hidden font-semibold sm:block">{team.rating}</span>
                  <span className="text-right text-sm font-medium"><Movement value={team.movement} /></span>
                </div>
              );
            })}
          </section>

          <p className="mt-6 text-xs leading-5 text-gray-500">
            Movement compares each team with its position before the latest completed week. Model ratings are directional power scores—not predicted win totals—and user picks do not affect them.
          </p>

          <details className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <summary className="cursor-pointer font-semibold">How the model works</summary>
            <div className="mt-4 space-y-3 text-sm leading-6 text-gray-400">
              <p>Teams begin with a preseason strength rating. Each final result moves both teams based on opponent quality and margin of victory.</p>
              <p>Game favorability combines team strength, home field, division-game limits, and rest differences. Manual adjustments are labeled on the Picks page.</p>
              <p>User picks never change model ratings. The scorecard above measures the favorite shown before each game against the final result.</p>
            </div>
          </details>
        </>
      ) : null}
    </main>
  );
}
