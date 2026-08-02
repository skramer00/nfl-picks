"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getGamesByWeek, type ScheduleGame } from "@/lib/gamesDb";
import { getUserPicks, upsertPick } from "@/lib/picksDb";
import { supabase } from "@/lib/supabaseClient";
import { formatFavorability } from "@/lib/favorability";
import { matchupExplanation } from "@/lib/modelAnalytics";
import { selectedTeamStyle } from "@/lib/teamColors";

const SEASON = 2026;
const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);

const pacificKickoff = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export default function WeekPage() {
  const params = useParams<{ week: string }>();
  const week = Number(params.week);
  const validWeek = Number.isInteger(week) && week >= 1 && week <= 18;
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [pickMessage, setPickMessage] = useState<string | null>(null);
  const completedPicks = games.filter((game) => Boolean(picks[game.id])).length;
  const weekComplete = signedIn && games.length > 0 && completedPicks === games.length;

  useEffect(() => {
    let cancelled = false;

    async function loadSchedule() {
      if (!validWeek) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const rows = await getGamesByWeek(SEASON, week);
        if (!cancelled) setGames(rows);
      } catch (loadError) {
        if (!cancelled) {
          setGames([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The schedule could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [validWeek, week]);

  useEffect(() => {
    async function loadPickState() {
      const { data: { user } } = await supabase.auth.getUser();
      setSignedIn(Boolean(user));
      if (user) {
        try {
          setPicks(await getUserPicks());
        } catch (pickError) {
          setPickMessage(pickError instanceof Error ? pickError.message : "Unable to load your picks.");
        }
      }
    }
    loadPickState();
  }, []);

  async function chooseTeam(game: ScheduleGame, teamId: string) {
    if (!signedIn) {
      setPickMessage("Log in to save picks.");
      return;
    }

    setSavingGameId(game.id);
    setPickMessage(null);
    try {
      await upsertPick(game.id, teamId);
      setPicks((current) => ({ ...current, [game.id]: teamId }));
      setPickMessage("Pick saved.");
    } catch (pickError) {
      setPickMessage(pickError instanceof Error ? pickError.message : "Unable to save that pick.");
    } finally {
      setSavingGameId(null);
    }
  }

  if (!validWeek) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-3xl font-semibold">Week not found</h1>
        <p className="mt-3 text-gray-400">Choose a regular-season week from 1–18.</p>
        <Link className="mt-5 inline-block text-blue-400 underline" href="/week/1">
          Go to Week 1
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
            {SEASON} regular season
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Week {week} schedule</h1>
          <p className="mt-2 text-sm text-gray-400">All kickoff times are shown in Pacific Time.</p>
        </div>
        {!loading && !error && (
          <p className="text-sm text-gray-400">
            {games.length} {games.length === 1 ? "game" : "games"}
          </p>
        )}
      </div>

      <nav aria-label="Choose a week" className="mt-6 flex flex-wrap gap-2">
        {WEEKS.map((weekNumber) => (
          <Link
            key={weekNumber}
            href={`/week/${weekNumber}`}
            aria-current={weekNumber === week ? "page" : undefined}
            className={`min-w-10 rounded-lg border px-3 py-2 text-center text-sm transition ${
              weekNumber === week
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-900"
            }`}
          >
            {weekNumber}
          </Link>
        ))}
      </nav>

      {signedIn && !loading && !error && games.length > 0 ? (
        <div className={`mt-5 rounded-xl border p-4 ${weekComplete ? "border-emerald-800 bg-emerald-950/30" : "border-gray-800 bg-gray-950"}`}>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className={weekComplete ? "font-semibold text-emerald-200" : "text-gray-300"}>
              {weekComplete ? `Week ${week} complete 🎉` : `${completedPicks} of ${games.length} picks complete`}
            </span>
            <span className="text-gray-500">{Math.round((completedPicks / games.length) * 100)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800"><div className={`h-full rounded-full transition-all ${weekComplete ? "bg-emerald-400" : "bg-blue-500"}`} style={{ width: `${(completedPicks / games.length) * 100}%` }} /></div>
        </div>
      ) : null}

      {pickMessage && (
        <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200" role="status">
          {pickMessage} {!signedIn && <Link className="ml-1 text-blue-400 underline" href="/login">Log in</Link>}
        </div>
      )}

      {loading && (
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-300" role="status">
          Loading Week {week} games…
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-6" role="alert">
          <h2 className="font-semibold text-red-200">Unable to load the schedule</h2>
          <p className="mt-2 text-sm text-red-300">{error}</p>
          <button
            className="mt-4 rounded-lg border border-red-700 px-3 py-2 text-sm hover:bg-red-900/40"
            onClick={() => window.location.reload()}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && games.length === 0 && (
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-300">
          No games were found for Week {week}.
        </div>
      )}

      {!loading && !error && games.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {games.map((game) => (
            <article key={game.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex items-start justify-between gap-4">
                <time className="text-sm font-medium text-blue-300" dateTime={game.kickoff_at}>
                  {pacificKickoff.format(new Date(game.kickoff_at))}
                </time>
                <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs capitalize text-gray-300">
                  {game.status}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  disabled={savingGameId === game.id || Date.now() >= new Date(game.kickoff_at).getTime()}
                  onClick={() => chooseTeam(game, game.away_team.id)}
                  style={picks[game.id] === game.away_team.id ? selectedTeamStyle(game.away_team.abbreviation) : undefined}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${picks[game.id] === game.away_team.id ? "text-white" : "border-gray-800 hover:border-gray-600"}`}
                >
                  <div>
                    <p className={`text-xs uppercase tracking-wide ${picks[game.id] === game.away_team.id ? "text-white/70" : "text-gray-500"}`}>Away</p>
                    <p className="mt-1 text-lg font-semibold">{game.away_team.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`block text-xl font-bold ${picks[game.id] === game.away_team.id ? "text-white" : "text-gray-300"}`}>{formatFavorability(game.away_win_prob)}</span>
                    <span className={`text-xs ${picks[game.id] === game.away_team.id ? "text-white/70" : "text-gray-500"}`}>favored</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={savingGameId === game.id || Date.now() >= new Date(game.kickoff_at).getTime()}
                  onClick={() => chooseTeam(game, game.home_team.id)}
                  style={picks[game.id] === game.home_team.id ? selectedTeamStyle(game.home_team.abbreviation) : undefined}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${picks[game.id] === game.home_team.id ? "text-white" : "border-gray-800 hover:border-gray-600"}`}
                >
                  <div>
                    <p className={`text-xs uppercase tracking-wide ${picks[game.id] === game.home_team.id ? "text-white/70" : "text-gray-500"}`}>Home</p>
                    <p className="mt-1 text-lg font-semibold">{game.home_team.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`block text-xl font-bold ${picks[game.id] === game.home_team.id ? "text-white" : "text-gray-300"}`}>{formatFavorability(game.home_win_prob)}</span>
                    <span className={`text-xs ${picks[game.id] === game.home_team.id ? "text-white/70" : "text-gray-500"}`}>favored</span>
                  </div>
                </button>
              </div>

              {game.favorability_override_reason ? (
                <p className="mt-4 rounded-lg border border-amber-900/80 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                  Adjusted favorability: {game.favorability_override_reason}
                </p>
              ) : null}

              {game.rest_advantage_team_id && game.rest_advantage_days ? (
                <p className="mt-4 rounded-lg border border-sky-900/80 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
                  Rest edge: {game.rest_advantage_team_id === game.home_team.id ? game.home_team.abbreviation : game.away_team.abbreviation}
                  {" · "}{game.rest_advantage_days} more {game.rest_advantage_days === 1 ? "day" : "days"} of rest
                </p>
              ) : null}

              <details className="mt-4 rounded-lg border border-gray-800 bg-black/30 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-gray-300">
                  Why these percentages?
                </summary>
                <ul className="mt-3 space-y-2 text-gray-400">
                  {matchupExplanation(game).map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <span aria-hidden="true" className="text-blue-400">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </details>

              <p className="mt-5 text-sm text-gray-500">{game.venue ?? "Venue TBD"}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
