"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getGamesBySeason } from "@/lib/gamesDb";

const sb = supabase;

const SEASON = 2026;
const MAX_WEEK = 22;

type GameRow = {
  id: string;
  season: number;
  week: number;
  kickoff_iso: string;
  away_team_id: string;
  home_team_id: string;
  status: string;
  winner_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_win_prob: number | null;
  away_win_prob: number | null;
  playoff_round: string | null;
  updated_at: string;
};

function fmtPct(p: number | null) {
  if (p == null) return "—";
  const pct = Math.round(p * 100);
  if (pct >= 45 && pct <= 55) return "Even";
  return `${pct}%`;
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

function winnerFromScores(
  homeScore: number | null,
  awayScore: number | null,
  homeId: string,
  awayId: string
) {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore === awayScore) return null;
  return homeScore > awayScore ? homeId : awayId;
}

function EditableGameRow({
  game,
  onSaved,
}: {
  game: GameRow;
  onSaved: () => Promise<void>;
}) {
  const [kickoffLocal, setKickoffLocal] = useState(toLocalInputValue(game.kickoff_iso));
  const [status, setStatus] = useState(game.status);
  const [homeScore, setHomeScore] = useState(game.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(game.away_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const kickoff_at = localInputToIso(kickoffLocal);
      const home_score = homeScore ? Number(homeScore) : null;
      const away_score = awayScore ? Number(awayScore) : null;

      let winner_team_id: string | null = null;

      if (status === "final") {
        if (home_score == null || away_score == null) {
          throw new Error("Final games must have both scores.");
        }
        winner_team_id = winnerFromScores(
          home_score,
          away_score,
          game.home_team_id,
          game.away_team_id
        );
        if (!winner_team_id) throw new Error("Final games must have a winner.");
      }

      const { error } = await sb
        .from("games")
        .update({
          kickoff_at,
          status,
          home_score,
          away_score,
          winner_team_id,
        } as never)
        .eq("id", game.id);

      if (error) throw error;

      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm">
      <div className="flex justify-between">
        <div className="font-medium text-gray-200">
          Week {game.week}: {game.away_team_id} @ {game.home_team_id}
        </div>
        <div className="text-xs text-gray-400">
          {fmtPct(game.away_win_prob)} / {fmtPct(game.home_win_prob)}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <input
          type="datetime-local"
          value={kickoffLocal}
          onChange={(e) => setKickoffLocal(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-sm"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-sm"
        >
          <option value="scheduled">scheduled</option>
          <option value="final">final</option>
        </select>

        <input
          inputMode="numeric"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-sm"
          placeholder="Away"
        />

        <input
          inputMode="numeric"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-sm"
          placeholder="Home"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [games, setGames] = useState<GameRow[]>([]);
  const [weekFilter, setWeekFilter] = useState<number | "all">("all");

  async function refresh() {
    const rows = await getGamesBySeason(SEASON);
    setGames(rows as GameRow[]);
  }

  useEffect(() => {
    async function init() {
      const { data: userData } = await sb.auth.getUser();
      const user = userData?.user;
      if (!user) return setLoading(false);

      const { data: profile } = await sb
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .single();

      setIsAdmin(Boolean(profile?.is_admin));
      if (profile?.is_admin) await refresh();
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <main className="p-6">Loading…</main>;
  if (!isAdmin) return <main className="p-6">Not authorized.</main>;

  const filteredGames =
    weekFilter === "all"
      ? games
      : games.filter((g) => g.week === weekFilter);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>

        <div className="flex gap-2">
          <select
            value={weekFilter}
            onChange={(e) =>
              setWeekFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          >
            <option value="all">All weeks</option>
            {Array.from({ length: MAX_WEEK }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Week {i + 1}
              </option>
            ))}
          </select>

        </div>
      </div>

      <div className="mt-6 space-y-3">
        {filteredGames.map((g) => (
          <EditableGameRow key={g.id} game={g} onSaved={refresh} />
        ))}
      </div>
    </main>
  );
}
