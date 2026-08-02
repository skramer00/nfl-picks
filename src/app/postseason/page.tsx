"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getGamesBySeason, type GameRow } from "@/lib/gamesDb";
import { getUserPicks } from "@/lib/picksDb";
import {
  buildPostseasonProjection,
  buildPlayoffHunt,
  playoffChances,
  picksProgress,
  type ConferenceProjection,
  type ProjectionMode,
  type ProjectedTeam,
} from "@/lib/postseasonProjection";
import { supabase } from "@/lib/supabaseClient";
import { getTeamTheme } from "@/lib/teamColors";

const SEASON = 2026;

function record(team: ProjectedTeam) {
  const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  return team.ties
    ? `${format(team.wins)}-${format(team.losses)}-${format(team.ties)}`
    : `${format(team.wins)}-${format(team.losses)}`;
}

function chanceLabel(chance: number) {
  if (chance === 0) return "<1%";
  return `${chance}%`;
}

function SeedCard({ team, chance }: { team: ProjectedTeam; chance: number }) {
  const theme = getTeamTheme(team.abbreviation);
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-gray-950 p-3"
      style={{ borderColor: theme.accent }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
        style={{ backgroundColor: theme.primary, boxShadow: `inset 0 -3px 0 ${theme.accent}` }}
      >
        {team.seed}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-gray-100">{team.name}</div>
        <div className="text-xs text-gray-500">
          {team.abbreviation} · {record(team)} {team.divisionWinner ? `· ${team.division} winner` : "· Wild card"}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold text-blue-200">{chanceLabel(chance)}</div>
        <div className="text-[10px] uppercase tracking-wide text-gray-600">Playoffs</div>
      </div>
    </div>
  );
}

function Matchup({ high, low }: { high: ProjectedTeam; low: ProjectedTeam }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium"><span className="mr-2 text-gray-500">{low.seed}</span>{low.abbreviation}</span>
        <span className="text-xs text-gray-600">at</span>
        <span className="font-medium">{high.abbreviation}<span className="ml-2 text-gray-500">{high.seed}</span></span>
      </div>
    </div>
  );
}

function ConferenceBracket({ projection, chances }: { projection: ConferenceProjection; chances: Map<string, number> }) {
  const teams = projection.teams;
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{projection.conference}</h2>
        <span className="text-xs uppercase tracking-widest text-gray-500">Projected seeds</span>
      </div>
      <div className="mt-4 space-y-2">
        {teams.map((team) => <SeedCard key={team.id} team={team} chance={chances.get(team.id) ?? 0} />)}
      </div>
      {teams.length === 7 ? (
        <div className="mt-6">
          <div className="mb-2 text-xs uppercase tracking-widest text-gray-500">Wild Card round</div>
          <div className="space-y-2">
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm">
              <span className="font-medium">{teams[0].abbreviation}</span>
              <span className="ml-2 text-gray-500">No. 1 seed · first-round bye</span>
            </div>
            <Matchup high={teams[1]} low={teams[6]} />
            <Matchup high={teams[2]} low={teams[5]} />
            <Matchup high={teams[3]} low={teams[4]} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function PostseasonPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<ProjectionMode>("model");
  const [conference, setConference] = useState<"AFC" | "NFC">("AFC");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const gameRowsPromise = getGamesBySeason(SEASON);
        const userResponse = await supabase.auth.getUser();
        const [gameRows, pickMap] = await Promise.all([
          gameRowsPromise,
          userResponse.data.user ? getUserPicks(userResponse.data.user.id) : Promise.resolve({}),
        ]);
        if (cancelled) return;
        setGames(gameRows);
        setPicks(pickMap);
        setSignedIn(Boolean(userResponse.data.user));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to build postseason projections.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const progress = useMemo(() => picksProgress(games, picks), [games, picks]);
  const projection = useMemo(
    () => mode === "user" && !progress.complete ? [] : buildPostseasonProjection(games, picks, mode),
    [games, mode, picks, progress.complete]
  );
  const finalGames = useMemo(
    () => games.filter((game) => game.status === "final").length,
    [games]
  );
  const chances = useMemo(() => playoffChances(games), [games]);
  const hunt = useMemo(
    () => buildPlayoffHunt(games, projection, chances),
    [chances, games, projection]
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-blue-400">2026 playoff picture</p>
        <h1 className="mt-1 text-3xl font-semibold">Postseason projection</h1>
        <p className="mt-3 text-gray-400">
          Completed games use their actual results. Future games use either the model favorite or your saved picks, so the picture evolves every week.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
      <div className="inline-flex rounded-xl border border-gray-800 bg-gray-950 p-1">
        <button
          type="button"
          aria-pressed={mode === "model"}
          onClick={() => setMode("model")}
          className={`rounded-lg px-4 py-2 text-sm ${mode === "model" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-900"}`}
        >
          Model
        </button>
        <button
          type="button"
          aria-pressed={mode === "user"}
          onClick={() => setMode("user")}
          className={`rounded-lg px-4 py-2 text-sm ${mode === "user" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-900"}`}
        >
          My picks
        </button>
      </div>
      <div className="inline-flex rounded-xl border border-gray-800 bg-gray-950 p-1" aria-label="Choose a conference">
        {(["AFC", "NFC"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={conference === option}
            onClick={() => setConference(option)}
            className={`rounded-lg px-6 py-2 text-sm ${conference === option ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-900"}`}
          >
            {option}
          </button>
        ))}
      </div>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-5 text-gray-500">
        Playoff chances always come from model simulations. “My picks” changes the projected field based on your completed card.
      </p>

      {loading ? <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-6">Building the playoff picture…</div> : null}
      {error ? <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">{error}</div> : null}

      {!loading && !error && mode === "user" && !signedIn ? (
        <div className="mt-8 rounded-xl border border-blue-900 bg-blue-950/30 p-6">
          <h2 className="font-semibold">Sign in to project your postseason</h2>
          <p className="mt-2 text-sm text-gray-300">Your projection is built from your saved regular-season picks.</p>
          <Link href="/login" className="mt-4 inline-block text-blue-300 underline">Log in</Link>
        </div>
      ) : null}

      {!loading && !error && mode === "user" && signedIn && !progress.complete ? (
        <div className="mt-8 rounded-xl border border-amber-900 bg-amber-950/30 p-6">
          <h2 className="font-semibold text-amber-100">Complete your remaining picks to unlock this projection</h2>
          <p className="mt-2 text-sm text-amber-200/80">
            {progress.resolved} of {progress.total} games are resolved ({finalGames} completed results and {progress.futurePicked} future picks). You still need {progress.futureRequired - progress.futurePicked} picks.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-950">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${progress.total ? (progress.resolved / progress.total) * 100 : 0}%` }} />
          </div>
          <Link href="/week/1" className="mt-4 inline-block text-amber-200 underline">Continue making picks</Link>
        </div>
      ) : null}

      {!loading && !error && projection.length ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div className="text-xs text-gray-500">Projection source</div>
              <div className="mt-1 font-semibold">{mode === "model" ? "Model favorability" : "Your picks"}</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div className="text-xs text-gray-500">Actual results included</div>
              <div className="mt-1 font-semibold">{finalGames} games</div>
            </div>
          </div>
          <div className="mt-10">
            {projection.filter((item) => item.conference === conference).map((item) => <ConferenceBracket key={item.conference} projection={item} chances={chances} />)}
          </div>
          <section className="mt-12 border-t border-gray-800 pt-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Bubble watch</p>
              <h2 className="mt-1 text-2xl font-semibold">In the Hunt</h2>
              <p className="mt-2 text-sm text-gray-400">Teams currently outside the projected field remain here until they are mathematically eliminated.</p>
            </div>
            <div className="mt-6">
              {hunt.filter((item) => item.conference === conference).map((item) => (
                <div key={item.conference}>
                  <h3 className="text-lg font-semibold">{item.conference}</h3>
                  <div className="mt-3 space-y-2">
                    {item.teams.length ? item.teams.map((team) => {
                      const theme = getTeamTheme(team.abbreviation);
                      return (
                        <div key={team.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3">
                          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: theme.primary }}>{team.abbreviation}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{team.name}</div>
                            <div className="text-xs text-gray-500">Projected {record({ ...team, seed: 0, divisionWinner: false })}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold text-amber-200">{chanceLabel(team.chance)}</div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-600">Playoffs</div>
                          </div>
                        </div>
                      );
                    }) : <p className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">No teams remain in the hunt.</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <p className="mt-10 text-xs leading-5 text-gray-500">
            Projection only. Division winners are seeded first, followed by three wild cards per conference. Ties are resolved with the preseason model rating, not the NFL’s full official tiebreaker procedure.
          </p>
        </>
      ) : null}
    </main>
  );
}
