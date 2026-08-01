"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getGamesBySeason, GameRow } from "@/lib/gamesDb";
import { getUserPicks } from "@/lib/picksDb";

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
  const [picks, setPicks] = useState<PickMap>({});
  const [viewMode, setViewMode] = useState<"week" | "team">("week");
  const [status, setStatus] = useState<string>("");

  // Load games
  useEffect(() => {
    async function loadGames() {
      try {
        setStatus("");
        const rows = await getGamesBySeason(SEASON);

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
      } catch (error) {
        console.error("My Picks loadGames error:", error);
        setStatus(error instanceof Error ? `Load failed: ${error.message}` : "Load failed.");
        setGames([]);
      }
    }

    loadGames();
  }, []);

  // Load picks
  useEffect(() => {
    async function loadPicks() {
      try {
        const map = await getUserPicks();
        setPicks(map);
      } catch (error) {
        console.error("My Picks loadPicks error:", error);
        // Not fatal; user might be logged out
      }
    }
    loadPicks();
  }, []);
  const groupedByWeek = useMemo(() => {
    const grouped: Record<number, Game[]> = {};
    for (const g of games) {
      if (!grouped[g.week]) grouped[g.week] = [];
      grouped[g.week].push(g);
    }
    return grouped;
  }, [games]);

  const groupedByTeam = useMemo(() => {
    const grouped: Record<string, Game[]> = {};
    for (const g of games) {
      for (const team of [g.homeTeamId, g.awayTeamId]) {
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(g);
      }
    }
    return grouped;
  }, [games]);

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

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">My Picks</h1>

      {status ? (
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200">
          {status}
        </div>
      ) : null}

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
                        <div className="mt-1">
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
      </div>
    </main>
  );
}
