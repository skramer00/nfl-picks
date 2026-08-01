"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getGamesBySeason, type GameRow } from "@/lib/gamesDb";
import { modelFavorite, projectedTeamRecord } from "@/lib/modelAnalytics";
import { buildPowerRankings } from "@/lib/powerRankings";
import { getTeamTheme } from "@/lib/teamColors";

const SEASON = 2026;

export default function TeamModelPage() {
  const params = useParams<{ team: string }>();
  const abbreviation = params.team.toUpperCase();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getGamesBySeason(SEASON)
      .then((rows) => {
        if (!cancelled) setGames(rows);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load this team.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rankings = useMemo(() => buildPowerRankings(games), [games]);
  const team = rankings.find((entry) => entry.abbreviation === abbreviation);
  const teamGames = useMemo(
    () => games.filter((game) => game.away_team.abbreviation === abbreviation || game.home_team.abbreviation === abbreviation),
    [abbreviation, games]
  );
  const projected = team ? projectedTeamRecord(teamGames, team.id) : null;
  const restEdges = team ? teamGames.filter((game) => game.rest_advantage_team_id === team.id).length : 0;
  const averageFavorability = team && teamGames.length
    ? Math.round(teamGames.reduce((total, game) => total + (game.home_team_id === team.id ? game.home_win_prob ?? 0.5 : game.away_win_prob ?? 0.5), 0) / teamGames.length * 100)
    : null;

  if (loading) return <main className="mx-auto max-w-5xl p-6 text-gray-400">Loading team model…</main>;
  if (error || !team || !projected) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold">Team not available</h1>
        <p className="mt-2 text-gray-400">{error || "The model could not find that team."}</p>
        <Link href="/power-rankings" className="mt-5 inline-block text-blue-300 underline">Back to Model</Link>
      </main>
    );
  }

  const theme = getTeamTheme(team.abbreviation);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/power-rankings" className="text-sm text-gray-400 hover:text-white">← Model Center</Link>
      <header className="mt-5 overflow-hidden rounded-3xl border bg-gray-950 p-6 sm:p-8" style={{ borderColor: theme.accent }}>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-16 items-center justify-center rounded-xl font-black text-white" style={{ backgroundColor: theme.primary }}>{team.abbreviation}</span>
          <div>
            <p className="text-sm text-gray-400">{team.conference} {team.division}</p>
            <h1 className="text-3xl font-bold">{team.name}</h1>
          </div>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-4">
          <Metric label="Power rank" value={`#${team.rank}`} detail={team.movement ? `${team.movement > 0 ? "Up" : "Down"} ${Math.abs(team.movement)}` : "No movement"} />
          <Metric label="Model rating" value={String(team.rating)} detail={`${team.ratingChange >= 0 ? "+" : ""}${team.ratingChange} this season`} />
          <Metric label="Projected record" value={`${projected.wins}-${projected.losses}${projected.ties ? `-${projected.ties}` : ""}`} detail="Finals + future favorites" />
          <Metric label="Avg. favorability" value={averageFavorability === null ? "—" : `${averageFavorability}%`} detail={`${restEdges} projected rest edges`} />
        </div>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
        <div className="border-b border-gray-800 px-5 py-4"><h2 className="font-semibold">Favorability by week</h2></div>
        {teamGames.map((game) => {
          const home = game.home_team_id === team.id;
          const probability = home ? game.home_win_prob ?? 0.5 : game.away_win_prob ?? 0.5;
          const opponent = home ? game.away_team : game.home_team;
          const favorite = modelFavorite(game);
          const finalLabel = game.status === "final" ? (game.winner_team_id === team.id ? "Win" : "Loss") : favorite.teamId === team.id ? "Projected win" : "Projected loss";
          return (
            <div key={game.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4rem] items-center gap-3 border-b border-gray-900 px-5 py-4 last:border-0 sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem]">
              <span className="text-sm text-gray-500">W{game.week}</span>
              <div><p className="font-medium">{home ? "vs." : "at"} {opponent.name}</p><p className="mt-1 text-xs text-gray-500">{game.rest_advantage_team_id === team.id && game.rest_advantage_days ? `${game.rest_advantage_days} more rest days` : "Standard rest"}</p></div>
              <span className="hidden text-sm text-gray-400 sm:block">{finalLabel}</span>
              <span className="text-right font-semibold">{Math.round(probability * 100)}%</span>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-gray-500">{detail}</p></div>;
}
