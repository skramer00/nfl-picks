import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="overflow-hidden rounded-3xl border border-gray-800 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_42%),linear-gradient(145deg,#111827,#030712)] px-6 py-12 sm:px-12 sm:py-16">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">
            🥨 Pretzel Quest
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
            Pick every game. Outsmart the model.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-300 sm:text-xl">
            Make your NFL picks, see where you disagree with the model, and follow your season all the way through the playoffs.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login?mode=signup"
              className="rounded-xl bg-amber-400 px-6 py-3.5 text-center font-semibold text-gray-950 transition hover:bg-amber-300"
            >
              Sign up free
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-gray-600 bg-black/20 px-6 py-3.5 text-center font-semibold text-white transition hover:border-gray-400 hover:bg-white/5"
            >
              Log in
            </Link>
            <Link
              href="/week"
              className="px-4 py-3.5 text-center font-medium text-gray-300 transition hover:text-white"
            >
              Explore the picks →
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="What you can do">
        {[
          ["Make your call", "Pick every matchup before kickoff and track your accuracy all season."],
          ["Challenge the model", "Use favorability, rest, and matchup context—then decide where the model is wrong."],
          ["See the whole season", "Follow projected playoffs, power rankings, and the leaderboard in one place."],
        ].map(([title, description]) => (
          <div key={title} className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-gray-800 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
        <div>
          <h2 className="text-xl font-semibold">Simple scoring, meaningful choices</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
            Earn a point for every pick, another for getting it right, and a bonus for calling an underdog. Picks lock when each game kicks off.
          </p>
        </div>
        <Link href="/leaderboard" className="mt-5 inline-flex shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300 sm:mt-0">
          View leaderboard →
        </Link>
      </section>
    </main>
  );
}
