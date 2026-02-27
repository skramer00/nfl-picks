import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold">NFL Picks 2026</h1>
      <p className="mt-2 text-gray-600">
        Pick every game of the season. Track your accuracy. Climb the leaderboard.
      </p>

      <div className="mt-6 space-y-3">
        <Link
          href="/week/1"
          className="block rounded-lg border px-4 py-3 hover:border-black"
        >
          Go to Week 1
        </Link>

        <Link
          href="/week/2"
          className="block rounded-lg border px-4 py-3 hover:border-black"
        >
          Go to Week 2 (not built yet)
        </Link>

        <Link
  href="/my-picks"
  className="block rounded-lg border px-4 py-3 hover:border-black"
>
  View My Picks
</Link>
      </div>
    </main>
  );
}