import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      {/* Hero */}
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">
          🥨 Pretzel Quest
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">NFL Picks 2026</h1>
        <p className="mt-3 text-lg text-gray-400">
          Pick every game. Beat the model. Win the league.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/week"
          className="rounded-xl bg-blue-600 px-6 py-3 text-center text-white font-medium hover:bg-blue-500"
        >
          Make This Week’s Picks
        </Link>

        <Link
          href="/playoffs"
          className="rounded-xl border border-gray-700 px-6 py-3 text-center hover:bg-gray-900"
        >
          View Playoff Projection
        </Link>

        <Link
          href="/leaderboard"
          className="rounded-xl border border-gray-700 px-6 py-3 text-center hover:bg-gray-900"
        >
          View Leaderboard
        </Link>
      </div>

      {/* Rules Section */}
      <div className="mt-12 rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">How It Works</h2>

        <ul className="mt-4 space-y-3 text-sm text-gray-300">
          <li>
            • <span className="font-medium">1 point</span> for every game you pick.
          </li>
          <li>
            • <span className="font-medium">+1 point</span> for every correct pick.
          </li>
          <li>
            • <span className="font-medium">+1 bonus</span> for correctly picking an underdog.
          </li>
          <li>
            • Playoffs multiply points:
            <span className="ml-2 text-gray-400">
              Wildcard (2×) • Divisional (3×) • Conference (4×) • Super Bowl (5×)
            </span>
          </li>
        </ul>

        <div className="mt-6 text-sm text-gray-400">
          Picks lock at kickoff. No edits after games start.
        </div>
      </div>

      {/* Strategy Section */}
      <div className="mt-10 rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">Strategy Tip</h2>
        <p className="mt-3 text-sm text-gray-300">
          Each matchup includes a win probability based on our ELO model.
          <br />
          <span className="text-gray-400">
            50% = coin flip. 65%+ = strong favorite. Big underdogs mean big bonus potential.
          </span>
        </p>
      </div>
    </main>
  );
}
