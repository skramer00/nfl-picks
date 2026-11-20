"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getGamesByWeek, type ScheduleGame } from "@/lib/gamesDb";
import { getPretzelPicks, getUserPicks, savePretzelPick, upsertPick } from "@/lib/picksDb";
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

function matchupRole(teamProbability: number, opponentProbability: number) {
  if (teamProbability === opponentProbability) return "even";
  return teamProbability > opponentProbability ? "favored" : "underdog";
}

export default function WeekPage() {
  const router = useRouter();
  const params = useParams<{ week: string }>();
  const week = Number(params.week);
  const validWeek = Number.isInteger(week) && week >= 1 && week <= 18;
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [pretzels, setPretzels] = useState<Record<number, string> | null>(null);
  const [savingPretzel, setSavingPretzel] = useState(false);
  const signedIn = Boolean(userId);
  const pretzelGameId = pretzels?.[week];
  const pretzelGame = games.find((game) => game.id === pretzelGameId);
  const pretzelLocked = pretzelGame ? Date.parse(pretzelGame.kickoff_at) <= Date.now() : false;
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
      setUserId(user?.id ?? null);
      if (user) {
        try {
          setPicks(await getUserPicks(user.id));
          setPretzels(await getPretzelPicks(SEASON, user.id));
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

  async function choosePretzel(game: ScheduleGame) {
    if (!userId || !picks[game.id] || savingPretzel || pretzelLocked) return;
    setSavingPretzel(true);
    setPickMessage(null);
    const remove = pretzelGameId === game.id;
    try {
      await savePretzelPick(userId, SEASON, week, game.id, remove);
      setPretzels(await getPretzelPicks(SEASON, userId));
      setPickMessage(remove ? "Pretzel Pick removed." : "Pretzel Pick saved.");
    } catch (error) {
      setPickMessage(error instanceof Error ? error.message : "Unable to save your Pretzel Pick.");
    } finally {
      setSavingPretzel(false);
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
    <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-semibold">Week {week} schedule</h1>
        {!loading && !error && (
          <p className="text-sm text-gray-300">
            {signedIn ? `${completedPicks} of ${games.length} picks saved${weekComplete ? " · Complete" : ""}` : `${games.length} ${games.length === 1 ? "game" : "games"}`}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-400">{SEASON} regular season · Pacific time</p>

      <nav aria-label="Choose a week" className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">
        {week > 1 && <Link aria-label={`Previous week, Week ${week - 1}`} href={`/week/${week - 1}`} className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-3 text-sm hover:bg-gray-900">Previous</Link>}
        <select aria-label="Jump to week" value={week} onChange={(event) => router.push(`/week/${event.target.value}`)}
          className="min-h-11 rounded-lg border border-gray-600 bg-gray-950 px-3 text-base text-white">
          {WEEKS.map((number) => <option key={number} value={number}>Week {number}</option>)}
        </select>
        {week < WEEKS.length && <Link aria-label={`Next week, Week ${week + 1}`} href={`/week/${week + 1}`} className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-3 text-sm hover:bg-gray-900">Next</Link>}
      </nav>
      <nav aria-label="Choose a week" className="mt-4 hidden flex-wrap gap-2 lg:flex">
        {WEEKS.map((weekNumber) => (
          <Link key={weekNumber} href={`/week/${weekNumber}`} aria-label={`Week ${weekNumber}`}
            aria-current={weekNumber === week ? "page" : undefined}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-sm transition ${weekNumber === week
              ? "border-blue-500 bg-blue-600 text-white"
              : "border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-900"}`}>
            {weekNumber}
          </Link>
        ))}
      </nav>

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
        <>
          <p className="mt-4 text-sm text-gray-300">
            <strong className="text-amber-300">🥨 Pretzel Pick</strong>{" · "}
            One per week · +1 if correct{pretzelLocked && " · Locked"}
          </p>
          <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
            {games.map((game) => {
              const locked = Date.parse(game.kickoff_at) <= Date.now();
              const isPretzel = pretzelGameId === game.id;
              const teams = [
                { side: "Away", team: game.away_team, probability: game.away_win_prob, opponent: game.home_win_prob },
                { side: "Home", team: game.home_team, probability: game.home_win_prob, opponent: game.away_win_prob },
              ];
              return (
                <article key={game.id} className="rounded-xl border border-gray-800 bg-gray-950 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <time className="font-medium text-blue-300" dateTime={game.kickoff_at}>
                      {pacificKickoff.format(new Date(game.kickoff_at))}
                    </time>
                    <span className="capitalize text-gray-300">{game.status}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {teams.map(({ side, team, probability, opponent }) => {
                      const selected = picks[game.id] === team.id;
                      return (
                        <button key={team.id} type="button" aria-pressed={selected}
                          disabled={savingGameId === game.id || locked}
                          onClick={() => void chooseTeam(game, team.id)}
                          style={selected ? selectedTeamStyle(team.abbreviation) : undefined}
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-blue-300 disabled:cursor-default ${selected ? "text-white" : "border-gray-800 enabled:hover:border-gray-500"}`}>
                          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                            <span className="break-words text-base font-semibold">{team.name}</span>
                            <span className="text-sm text-gray-300">{side}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-lg leading-tight font-bold tabular-nums">{formatFavorability(probability)}</span>
                            <span className="block text-sm leading-tight text-gray-300">{matchupRole(probability, opponent)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex flex-wrap items-start gap-x-3">
                    {signedIn && (isPretzel || (picks[game.id] && !locked && !pretzelLocked)) && (
                      <button type="button" aria-pressed={isPretzel}
                        disabled={pretzels === null || savingPretzel || pretzelLocked || locked}
                        onClick={() => void choosePretzel(game)}
                        className={`min-h-11 rounded-lg px-2 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-default ${isPretzel ? "bg-amber-950 text-amber-200" : "text-gray-200 enabled:hover:bg-gray-800"}`}>
                        <span aria-hidden="true">🥨 </span>
                        {isPretzel ? (pretzelLocked ? "Pretzel Pick locked" : "Remove Pretzel Pick") : "Set Pretzel Pick"}
                      </button>
                    )}
                    <details className="ml-auto open:ml-0 open:basis-full text-sm">
                      <summary className="w-fit cursor-pointer rounded-lg px-2 py-3 font-semibold text-gray-300 hover:bg-gray-800">Game details</summary>
                      <div className="space-y-2 border-t border-gray-800 pt-2 text-gray-300">
                        <p>{game.venue ?? "Venue TBD"}</p>
                        {game.favorability_override_reason && <p className="text-amber-200">Adjusted favorability: {game.favorability_override_reason}</p>}
                        {game.rest_advantage_team_id && game.rest_advantage_days ? (
                          <p className="text-sky-200">
                            Rest edge: {game.rest_advantage_team_id === game.home_team.id ? game.home_team.abbreviation : game.away_team.abbreviation}
                            {" · "}{game.rest_advantage_days} more {game.rest_advantage_days === 1 ? "day" : "days"} of rest
                          </p>
                        ) : null}
                        <p className="font-semibold">Why these percentages?</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {matchupExplanation(game).map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
