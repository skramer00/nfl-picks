"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Database } from "@/lib/database.types";
import { formatFavorability } from "@/lib/favorability";
import { getGamesBySeason, type GameRow } from "@/lib/gamesDb";
import { supabase } from "@/lib/supabaseClient";

const SEASON = 2026;
const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);

type SyncRun = Database["public"]["Tables"]["sync_runs"]["Row"];

type HealthResponse = {
  runs: SyncRun[];
  schedule: string;
};

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function unmatchedCount(run: SyncRun) {
  return Array.isArray(run.unmatched) ? run.unmatched.length : 0;
}

function statusTone(status: string) {
  if (status === "success") return "text-emerald-300 bg-emerald-950/70 border-emerald-800";
  if (status === "error") return "text-red-300 bg-red-950/70 border-red-800";
  return "text-amber-200 bg-amber-950/70 border-amber-800";
}

function FavorabilityEditor({
  game,
  token,
  onSaved,
}: {
  game: GameRow;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [homePercent, setHomePercent] = useState(Math.round((game.home_win_prob ?? 0.5) * 100));
  const [reason, setReason] = useState(game.favorability_override_reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/favorability", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gameId: game.id,
          homeWinProbability: homePercent / 100,
          reason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save override.");
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save override.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/favorability?gameId=${game.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to remove override.");
      await onSaved();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to remove override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-gray-100">
            {game.away_team.abbreviation} at {game.home_team.abbreviation}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Model: {formatFavorability(game.away_win_prob ?? 0.5)} away / {formatFavorability(game.home_win_prob ?? 0.5)} home
          </div>
        </div>
        {game.favorability_override_reason ? (
          <span className="rounded-full border border-amber-800 bg-amber-950/70 px-2 py-1 text-xs text-amber-200">
            Manual override
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[130px_1fr_auto]">
        <label className="text-xs text-gray-400">
          Home favorability
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={25}
              max={75}
              value={homePercent}
              onChange={(event) => setHomePercent(Number(event.target.value))}
              className="w-20 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
            />
            <span>%</span>
          </div>
        </label>
        <label className="text-xs text-gray-400">
          Reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Injury, coordinator change, or manual model correction"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </label>
        <div className="flex items-end gap-2">
          {game.favorability_override_reason ? (
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-900 disabled:opacity-50"
            >
              Reset
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [schedule, setSchedule] = useState("");
  const [week, setWeek] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (accessToken: string) => {
    const [gameRows, healthResponse] = await Promise.all([
      getGamesBySeason(SEASON),
      fetch("/api/admin/sync", { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const health = (await healthResponse.json()) as HealthResponse & { error?: string };
    if (!healthResponse.ok) throw new Error(health.error ?? "Unable to load sync health.");
    setGames(gameRows);
    setRuns(health.runs);
    setSchedule(health.schedule);
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        const accessToken = session?.access_token;
        if (!accessToken) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", session.user.id)
          .single();
        if (!profile?.is_admin) return;
        setAuthorized(true);
        setToken(accessToken);
        await load(accessToken);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load admin tools.");
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, [load]);

  const weekGames = useMemo(() => games.filter((game) => game.week === week), [games, week]);
  const latest = runs[0];

  async function refresh() {
    if (token) await load(token);
  }

  async function syncNow() {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ week }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Sync failed.");
      setMessage(
        payload.summary
          ? `Week ${week}: ${payload.summary.matched} matched, ${payload.summary.updated} updated, ${payload.summary.unmatched.length} unmatched.`
          : payload.message
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl p-6">Loading admin tools…</main>;
  if (!authorized) return <main className="mx-auto max-w-6xl p-6">Administrator access required.</main>;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">Operations</p>
          <h1 className="text-3xl font-semibold">Data health</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={week}
            onChange={(event) => setWeek(Number(event.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          >
            {WEEKS.map((value) => <option key={value} value={value}>Week {value}</option>)}
          </select>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {message ? <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm">{message}</div> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <div className="text-sm text-gray-400">Last run</div>
          <div className="mt-2 text-xl font-semibold">{dateTime(latest?.finished_at ?? null)}</div>
          <div className="mt-1 text-xs text-gray-500">{latest?.source ?? "No recorded runs yet"}</div>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <div className="text-sm text-gray-400">Health</div>
          <div className="mt-2">
            {latest ? (
              <span className={`rounded-full border px-3 py-1 text-sm ${statusTone(latest.status)}`}>{latest.status}</span>
            ) : <span className="text-gray-500">Awaiting first tracked run</span>}
          </div>
          <div className="mt-3 text-xs text-gray-500">{latest ? `${latest.matched} matched · ${unmatchedCount(latest)} unmatched` : "—"}</div>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <div className="text-sm text-gray-400">Next automatic run</div>
          <div className="mt-2 text-base font-medium">{schedule}</div>
          <div className="mt-1 text-xs text-gray-500">Vercel Hobby daily schedule</div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent syncs</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950 text-gray-400">
              <tr><th className="p-3">Started</th><th className="p-3">Status</th><th className="p-3">Weeks</th><th className="p-3">Matched</th><th className="p-3">Updated</th><th className="p-3">Unmatched</th></tr>
            </thead>
            <tbody>
              {runs.length ? runs.map((run) => (
                <tr key={run.id} className="border-t border-gray-800">
                  <td className="p-3">{dateTime(run.started_at)}</td>
                  <td className="p-3">{run.status}</td>
                  <td className="p-3">{run.weeks.join(", ")}</td>
                  <td className="p-3">{run.matched}</td>
                  <td className="p-3">{run.updated}</td>
                  <td className="p-3">{unmatchedCount(run)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="p-6 text-center text-gray-500">No tracked runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div>
          <h2 className="text-xl font-semibold">Week {week} favorability</h2>
          <p className="mt-1 text-sm text-gray-400">Overrides are capped at 75/25 and require an explanation.</p>
        </div>
        <div className="mt-4 space-y-3">
          {weekGames.map((game) => <FavorabilityEditor key={game.id} game={game} token={token} onSaved={refresh} />)}
        </div>
      </section>
    </main>
  );
}
