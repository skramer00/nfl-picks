"use client";

import { useEffect, useMemo, useState } from "react";

import { getGamesBySeason, type GameRow } from "@/lib/gamesDb";
import { buildPowerRankings, type PowerRanking } from "@/lib/powerRankings";
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

export default function PowerRankingsPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [filter, setFilter] = useState<ConferenceFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getGamesBySeason(SEASON)
      .then((rows) => {
        if (!cancelled) setGames(rows);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to build the power rankings."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
          {SEASON} model
        </p>
        <h1 className="mt-1 text-3xl font-semibold">NFL Power Rankings</h1>
        <p className="mt-3 text-gray-400">
          A model-only view of all 32 teams. Rankings start with preseason team strength, then move with completed results, opponent quality, and margin of victory.
        </p>
      </div>

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
                      <div className="truncate font-semibold">{team.name}</div>
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
        </>
      ) : null}
    </main>
  );
}
