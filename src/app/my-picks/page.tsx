"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SeasonRecap } from "@/components/SeasonRecap";
import { getGamesBySeason, GameRow } from "@/lib/gamesDb";
import { getUserPicks } from "@/lib/picksDb";
import { supabase } from "@/lib/supabaseClient";

type PickMap = Record<string, string>;

type Game = {
  id: string;
  week: number;
  kickoffISO: string | null;
  awayTeamId: string;
  homeTeamId: string;
  awayTeamName: string;
  homeTeamName: string;
  awayTeamAbbreviation: string;
  homeTeamAbbreviation: string;
  status: "scheduled" | "final";
  winnerTeamId: string | null;
  awayWinProb: number | null;
  homeWinProb: number | null;
};

const SEASON = 2026;

// Optional: same playoff labels you use elsewhere
const PLAYOFF_LABELS: Record<number, string> = {
  19: "Wildcard",
  20: "Divisional",
  21: "Conference",
  22: "Super Bowl",
};

function weekTitle(w: number) {
  return PLAYOFF_LABELS[w] ? `Week ${w} — ${PLAYOFF_LABELS[w]}` : `Week ${w}`;
}

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function MyPicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [gameRows, setGameRows] = useState<GameRow[]>([]);
  const [picks, setPicks] = useState<PickMap>({});
  const [viewMode, setViewMode] = useState<"week" | "team">("week");
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState("");
  const [section, setSection] = useState<"summary" | "recap">("summary");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setStatus("");
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setSignedIn(false);
          return;
        }

        setSignedIn(true);
        setUserId(user.id);
        const [rows, map] = await Promise.all([
          getGamesBySeason(SEASON),
          getUserPicks(user.id),
        ]);
        if (cancelled) return;

        const typedRows = rows as GameRow[];
        const hasFinalResults = typedRows.some((game) => game.status === "final");
        setGameRows(typedRows);
        if (window.location.hash === "#recap" && hasFinalResults) {
          setSection("recap");
        } else if (window.location.hash === "#recap") {
          history.replaceState(null, "", "/my-picks");
        }
        setGames(
          (rows as GameRow[]).map((r) => ({
            id: r.id,
            week: r.week,
            kickoffISO: r.kickoff_iso,
            awayTeamId: r.away_team_id,
            homeTeamId: r.home_team_id,
            awayTeamName: r.away_team.name,
            homeTeamName: r.home_team.name,
            awayTeamAbbreviation: r.away_team.abbreviation,
            homeTeamAbbreviation: r.home_team.abbreviation,
            status: (r.status as Game["status"]) ?? "scheduled",
            winnerTeamId: r.winner_team_id ?? null,
            awayWinProb: r.away_win_prob ?? null,
            homeWinProb: r.home_win_prob ?? null,
          }))
        );
        setPicks(map);
      } catch (error) {
        console.error("My Picks loadGames error:", error);
        setStatus(error instanceof Error ? `Load failed: ${error.message}` : "Load failed.");
        setGames([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);
  const hasResults = gameRows.some((game) => game.status === "final");
  const filteredGames = useMemo(
    () => selectedTeamId === "all"
      ? games
      : games.filter((game) => game.homeTeamId === selectedTeamId || game.awayTeamId === selectedTeamId),
    [games, selectedTeamId]
  );
  const groupedByWeek = useMemo(() => {
    const grouped: Record<number, Game[]> = {};
    for (const g of filteredGames) {
      if (!grouped[g.week]) grouped[g.week] = [];
      grouped[g.week].push(g);
    }
    return grouped;
  }, [filteredGames]);

  const groupedByTeam = useMemo(() => {
    const grouped: Record<string, Game[]> = {};
    for (const g of filteredGames) {
      const teams = selectedTeamId === "all"
        ? [g.homeTeamId, g.awayTeamId]
        : [selectedTeamId];
      for (const team of teams) {
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(g);
      }
    }
    return grouped;
  }, [filteredGames, selectedTeamId]);

  const dashboard = useMemo(() => {
    const totalGames = games.length;
    const picksMade = games.filter((g) => Boolean(picks[g.id])).length;

    const finalGames = games.filter((g) => g.status === "final" && g.winnerTeamId);
    const finalPicked = finalGames.filter((g) => Boolean(picks[g.id]));
    const correct = finalPicked.filter((g) => picks[g.id] === g.winnerTeamId).length;

    const accuracy =
      finalPicked.length > 0
        ? Math.round((correct / finalPicked.length) * 1000) / 10
        : 0;

    const pctPicked = totalGames > 0 ? Math.round((picksMade / totalGames) * 100) : 0;

    return {
      totalGames,
      picksMade,
      pctPicked,
      finalGamesCount: finalGames.length,
      finalPickedCount: finalPicked.length,
      correct,
      accuracy,
    };
  }, [games, picks]);

  const teamById = useMemo(() => {
    const teams: Record<string, { name: string; abbreviation: string }> = {};
    for (const game of games) {
      teams[game.awayTeamId] = { name: game.awayTeamName, abbreviation: game.awayTeamAbbreviation };
      teams[game.homeTeamId] = { name: game.homeTeamName, abbreviation: game.homeTeamAbbreviation };
    }
    return teams;
  }, [games]);

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6">Loading your picks…</main>;
  }

  if (signedIn === false) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Season Summary</h1>
        <div className="mt-4 rounded-xl border border-blue-900 bg-blue-950/30 p-5">
          <h2 className="font-semibold text-blue-100">Log in to view your season</h2>
          <p className="mt-2 text-sm text-gray-300">Your saved picks, accuracy, and weekly results will appear here.</p>
          <Link href="/login" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Season Summary</h1>
      {hasResults ? <div className="mt-5 inline-flex rounded-xl border border-gray-800 bg-gray-950 p-1" aria-label="Season view">
        <button type="button" onClick={() => { setSection("summary"); history.replaceState(null, "", "/my-picks"); }} className={`rounded-lg px-4 py-2 text-sm ${section === "summary" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}>Summary</button>
        <button type="button" onClick={() => { setSection("recap"); history.replaceState(null, "", "/my-picks#recap"); }} className={`rounded-lg px-4 py-2 text-sm ${section === "recap" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}>Weekly Recap</button>
      </div> : null}

      {status ? (
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200">
          {status}
        </div>
      ) : null}

      {hasResults && section === "recap" ? <SeasonRecap games={gameRows} picks={picks} userId={userId} /> : <>
      {/* Top dashboard: 3 cards in one row */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs text-gray-400">Season accuracy</div>
          <div className="mt-1 text-2xl font-semibold">
            {dashboard.correct}/{dashboard.finalPickedCount}{" "}
            <span className="text-base font-normal text-gray-300">
              ({dashboard.accuracy}%)
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Final games available: {dashboard.finalGamesCount}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs text-gray-400">Picks made</div>
          <div className="mt-1 text-2xl font-semibold">
            {dashboard.picksMade}/{dashboard.totalGames}{" "}
            <span className="text-base font-normal text-gray-300">
              ({dashboard.pctPicked}%)
            </span>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-gray-200"
              style={{ width: `${dashboard.pctPicked}%` }}
            />
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Tip: you can make picks ahead—everything locks at kickoff.
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs text-gray-400">View</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setViewMode("week")}
              className={`rounded-lg border px-3 py-2 text-sm ${
                viewMode === "week"
                  ? "border-gray-200 bg-gray-800 text-white"
                  : "border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800"
              }`}
            >
              By Week
            </button>

            <button
              onClick={() => setViewMode("team")}
              className={`rounded-lg border px-3 py-2 text-sm ${
                viewMode === "team"
                  ? "border-gray-200 bg-gray-800 text-white"
                  : "border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800"
              }`}
            >
              By Team
            </button>
          </div>
          <label className="mt-4 block text-xs text-gray-400" htmlFor="team-filter">Team filter</label>
          <select
            id="team-filter"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
          >
            <option value="all">All teams</option>
            {Object.entries(teamById)
              .sort(([, first], [, second]) => first.name.localeCompare(second.name))
              .map(([id, team]) => <option key={id} value={id}>{team.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {viewMode === "week" &&
          Object.entries(groupedByWeek)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([weekStr, weekGames]) => {
              const week = Number(weekStr);
              return (
                <div key={weekStr}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{weekTitle(week)}</h2>
                    <Link
                      href={`/week/${week}`}
                      className="text-sm text-gray-300 underline hover:text-white"
                    >
                      Open week →
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {weekGames.map((g) => {
                      const picked = picks[g.id];
                      const isFinal = g.status === "final" && g.winnerTeamId;

                      return (
                        <div
                          key={g.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3 text-sm"
                        >
                          <div className="text-gray-200">
                            <span>{g.awayTeamName} @ {g.homeTeamName}</span>
                            <span className="ml-1 text-xs text-gray-500">
                              • Favorability: {g.awayTeamAbbreviation} {pct(g.awayWinProb)} · {g.homeTeamAbbreviation} {pct(g.homeWinProb)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-gray-300">
                              {picked ? (
                                <span>
                                  Picked: <span className="font-medium">{teamById[picked]?.name ?? "Unknown team"}</span>
                                </span>
                              ) : (
                                <span className="text-gray-500">No pick</span>
                              )}
                            </div>

                            {isFinal && picked ? (
                              <div className="text-lg">
                                {picked === g.winnerTeamId ? "✅" : "❌"}
                              </div>
                            ) : null}
                            <Link href={`/week/${g.week}`} className="font-medium text-blue-300 hover:underline">Edit</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

        {viewMode === "team" &&
          Object.entries(groupedByTeam)
            .sort((a, b) => (teamById[a[0]]?.name ?? a[0]).localeCompare(teamById[b[0]]?.name ?? b[0]))
            .map(([team, teamGames]) => (
              <div key={team}>
                <h2 className="mb-2 text-lg font-semibold">{teamById[team]?.name ?? "Unknown team"}</h2>

                <div className="space-y-2">
                  {teamGames.map((g) => {
                    const picked = picks[g.id];
                    const isFinal = g.status === "final" && g.winnerTeamId;

                    return (
                      <div
                        key={g.id}
                        className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-sm"
                      >
                        Week {g.week}: {g.awayTeamName} @ {g.homeTeamName}{" "}
                        <span className="text-xs text-gray-500">
                          • Favorability: {g.awayTeamAbbreviation} {pct(g.awayWinProb)} · {g.homeTeamAbbreviation} {pct(g.homeWinProb)}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                          <div>
                          {picked ? (
                            <span className="text-gray-200">
                              Picked: <span className="font-medium">{teamById[picked]?.name ?? "Unknown team"}</span>
                            </span>
                          ) : (
                            <span className="text-gray-500">No pick</span>
                          )}

                          {isFinal ? (
                            <span className="ml-2 text-xs text-gray-500">
                              • Final: {g.winnerTeamId ? teamById[g.winnerTeamId]?.name ?? "Unknown team" : ""}{" "}
                              {picked ? (picked === g.winnerTeamId ? "✅" : "❌") : ""}
                            </span>
                          ) : null}
                          </div>
                          <Link href={`/week/${g.week}`} className="font-medium text-blue-300 hover:underline">Edit</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
      </div>
      </>}
    </main>
  );
}
