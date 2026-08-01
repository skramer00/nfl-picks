"use client";

import { useEffect, useMemo, useState } from "react";
import modelData from "@/data/model_picks_2026.json";
import { getGamesBySeason, type GameRow } from "@/lib/gamesDb";
import { getUserPicks } from "@/lib/picksDb";
import {
  ConferenceProjection,
  PlayoffSeed,
  projectPlayoffs,
  TeamStanding,
} from "@/lib/playoffs";
import { ALL_GAMES, type Game, TEAM_BY_ABBR } from "@/lib/season";

type ProjectionSource = "user" | "model";

const modelPicks = modelData.picks as Record<string, string>;

function normalizeTeam(abbreviation: string) {
  return abbreviation === "WAS" ? "WSH" : abbreviation;
}

function matchupKey(week: number, awayTeam: string, homeTeam: string) {
  return `${week}:${normalizeTeam(awayTeam)}:${normalizeTeam(homeTeam)}`;
}

function mergeLiveSeason(rows: GameRow[], storedPicks: Record<string, string>) {
  const regularSeasonRows = rows.filter((row) => row.week >= 1 && row.week <= 18);
  const rowsByMatchup = new Map(
    regularSeasonRows.map((row) => [
      matchupKey(row.week, row.away_team.abbreviation, row.home_team.abbreviation),
      row,
    ]),
  );
  const projectedPicks: Record<string, string> = {};

  const games = ALL_GAMES.map((scheduledGame) => {
    const row = rowsByMatchup.get(
      matchupKey(
        scheduledGame.week,
        scheduledGame.awayTeam,
        scheduledGame.homeTeam,
      ),
    );
    if (!row) return scheduledGame;

    const pickedTeamId = storedPicks[row.id];
    if (pickedTeamId === row.away_team_id) {
      projectedPicks[scheduledGame.id] = normalizeTeam(row.away_team.abbreviation);
    } else if (pickedTeamId === row.home_team_id) {
      projectedPicks[scheduledGame.id] = normalizeTeam(row.home_team.abbreviation);
    }

    const isFinal = row.status === "final";
    const isTie =
      isFinal &&
      row.away_score !== null &&
      row.home_score !== null &&
      row.away_score === row.home_score;
    const winner =
      row.winner_team_id === row.away_team_id
        ? normalizeTeam(row.away_team.abbreviation)
        : row.winner_team_id === row.home_team_id
          ? normalizeTeam(row.home_team.abbreviation)
          : null;

    return {
      ...scheduledGame,
      kickoffISO: row.kickoff_iso,
      status: isFinal ? "final" : "scheduled",
      winner,
      isTie,
      awayScore: row.away_score,
      homeScore: row.home_score,
    } satisfies Game;
  });

  return { games, projectedPicks };
}

function recordText(standing: { wins: number; losses: number; ties: number }) {
  return `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}`;
}

function TeamBadge({ team }: { team: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-xs font-bold text-white">
      {team}
    </div>
  );
}

function SeedRow({ seed }: { seed: PlayoffSeed }) {
  const team = TEAM_BY_ABBR[seed.team];
  return (
    <div className="border-b border-gray-800 px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="w-5 text-center text-lg font-bold text-gray-400">{seed.seed}</div>
        <TeamBadge team={seed.team} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-white">{team.name}</span>
            <span className="text-xs text-gray-400">{seed.berth}</span>
          </div>
          {seed.tiebreaker && seed.tiebreaker.criterion !== "Record" && (
            <div
              className={`mt-0.5 text-xs ${
                seed.tiebreaker.provisional ? "text-amber-300" : "text-sky-300"
              }`}
            >
              {seed.tiebreaker.criterion}
              {seed.tiebreaker.provisional ? " · provisional" : ""}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{recordText(seed.standing)}</div>
          {seed.standing.gamesUnresolved > 0 && (
            <div className="text-[11px] text-amber-300">
              {seed.standing.gamesUnresolved} unpicked
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DivisionTable({ name, rows }: { name: string; rows: TeamStanding[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
        {name.replace(/^AFC |^NFC /, "")}
      </div>
      {rows.map((standing, index) => (
        <div
          key={standing.team}
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-gray-900 px-3 py-2 text-sm last:border-b-0"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-4 text-xs text-gray-500">{index + 1}</span>
            <span className="font-medium">{standing.team}</span>
          </div>
          <span className="tabular-nums text-gray-200">{recordText(standing)}</span>
          <span className="hidden tabular-nums text-xs text-gray-500 sm:inline">
            DIV {recordText(standing.division)}
          </span>
          <span className="hidden tabular-nums text-xs text-gray-500 lg:inline">
            CONF {recordText(standing.conference)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConferencePanel({ projection }: { projection: ConferenceProjection }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">{projection.conference}</h2>
        <span className="text-xs text-gray-500">7 playoff teams</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 bg-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
          Projected seeds
        </div>
        {projection.seeds.map((seed) => (
          <SeedRow key={seed.seed} seed={seed} />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(projection.divisions).map(([division, rows]) => (
          <DivisionTable key={division} name={division} rows={rows} />
        ))}
      </div>
    </section>
  );
}

export default function PlayoffsPage() {
  const [userPicks, setUserPicks] = useState<Record<string, string>>({});
  const [projectionGames, setProjectionGames] = useState<Game[]>(ALL_GAMES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<ProjectionSource>("user");

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      try {
        const [rows, storedPicks] = await Promise.all([
          getGamesBySeason(2026),
          getUserPicks(),
        ]);
        if (cancelled) return;
        const merged = mergeLiveSeason(rows, storedPicks);
        setProjectionGames(merged.games);
        setUserPicks(merged.projectedPicks);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Your saved picks could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProjection();
    return () => {
      cancelled = true;
    };
  }, []);

  const activePicks = source === "user" ? userPicks : modelPicks;
  const projection = useMemo(
    () => projectPlayoffs(activePicks, projectionGames),
    [activePicks, projectionGames],
  );
  const completion = Math.round(
    (projection.completedSelections / projection.totalGames) * 100,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-5 border-b border-gray-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            2026 postseason picture
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Playoff Projection</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
            Every selected winner becomes a projected result. Division champions and the
            three wild cards in each conference are then seeded with the NFL&apos;s official
            tiebreaking order.
          </p>
        </div>

        <div
          className="inline-flex w-fit rounded-xl border border-gray-700 bg-gray-900 p-1"
          role="group"
          aria-label="Projection source"
        >
          <button
            type="button"
            onClick={() => setSource("user")}
            aria-pressed={source === "user"}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              source === "user"
                ? "bg-white text-black"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            My picks
          </button>
          <button
            type="button"
            onClick={() => setSource("model")}
            aria-pressed={source === "model"}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              source === "model"
                ? "bg-white text-black"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            Model
          </button>
        </div>
      </div>

      {loading && source === "user" && (
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-300" role="status">
          Loading your saved season picks…
        </div>
      )}

      {loadError && source === "user" && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200" role="alert">
          Your saved picks could not be loaded. Sign in and refresh to view your projection.
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <div
          className={`rounded-xl border p-4 ${
            projection.unresolvedGames
              ? "border-amber-700/70 bg-amber-950/30"
              : "border-emerald-800 bg-emerald-950/25"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">
                {source === "user" ? "Your season picks" : modelData.label}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {projection.completedSelections} of {projection.totalGames} games resolved
                {projection.unresolvedGames
                  ? ` · ${projection.unresolvedGames} still need picks`
                  : " · complete projection"}
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums">{completion}%</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full ${
                projection.unresolvedGames ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
        {source === "model" && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-xs leading-5 text-gray-400 md:max-w-sm">
            <span className="font-semibold text-gray-200">Model method: </span>
            {modelData.methodology}
          </div>
        )}
      </div>

      {projection.unresolvedGames > 0 && source === "user" && (
        <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          This is a partial picture. Unpicked games do not count as wins or losses, so seeds
          become reliable only after the full season is picked.
        </div>
      )}

      {projection.provisionalTies.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-300">
          <span className="font-semibold text-amber-300">Provisional tiebreaks:</span>{" "}
          {projection.provisionalTies.length} tie
          {projection.provisionalTies.length === 1 ? "" : "s"} reached a scoring-based
          criterion that winner-only picks cannot calculate. Those rows are labeled instead
          of presenting the display order as official.
        </div>
      )}

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <ConferencePanel projection={projection.conferences.AFC} />
        <ConferencePanel projection={projection.conferences.NFC} />
      </div>

      <details className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-4">
        <summary className="cursor-pointer font-semibold text-gray-100">
          How the NFL tiebreakers are applied
        </summary>
        <div className="mt-4 grid gap-5 text-sm leading-6 text-gray-400 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-gray-200">Within a division</h3>
            <p className="mt-1">
              Head-to-head, division record, common games, conference record, strength of
              victory, strength of schedule, then the NFL&apos;s scoring and touchdown
              comparisons.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-200">Wild card and seeding</h3>
            <p className="mt-1">
              One club per division enters a multi-club comparison, followed by a
              head-to-head sweep, conference record, common games (minimum four), strength
              of victory, strength of schedule, and the remaining statistical steps. The
              process restarts after each qualifier is selected.
            </p>
          </div>
        </div>
        <a
          href="https://www.nfl.com/standings/tie-breaking-procedures"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Read the official NFL procedure ↗
        </a>
      </details>
    </main>
  );
}
