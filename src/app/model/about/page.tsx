import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About the Model | Pretzel Quest",
  description: "How Pretzel Quest turns team strength and matchup context into NFL game favorability and playoff projections.",
};

const inputs = [
  { title: "Team performance", text: "Opponent-adjusted scoring, play efficiency, and result quality form the starting strength for every team." },
  { title: "Quarterbacks", text: "Recent quarterback performance, sample size, continuity, and weekly availability help describe the offense expected to play." },
  { title: "Offseason context", text: "Confirmed coaching changes and only clearly material veteran trades receive small, bounded adjustments." },
  { title: "The matchup", text: "Home field, extra rest, early-season uncertainty, and the unpredictability of division games shape each individual game." },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-gray-400 sm:text-base sm:leading-7">{children}</div>
    </section>
  );
}

export default function AboutModelPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/power-rankings" className="text-sm text-gray-400 hover:text-white">← Model Center</Link>

      <div className="mt-6 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">Pretzel Quest model</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">A guide to the percentages</h1>
        <p className="mt-5 text-lg leading-8 text-gray-300">
          The model is an independent estimate of team strength and game outcomes. It is designed to give every pick a useful baseline—not to tell you which team you have to choose.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">What goes into the model</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {inputs.map((input) => (
            <article key={input.title} className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
              <h3 className="font-semibold text-gray-100">{input.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{input.text}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-4">
        <Section title="What favorability means">
          <p>Favorability is the model’s estimate of how often each team would win this matchup under the current assumptions. A 60% team is favored, but the 40% underdog still has a very real path to winning.</p>
          <p>These are not betting odds or a prediction of the final score. Week 1 estimates are intentionally pulled closer together, and division matchups stay more competitive because those games are often unusually volatile.</p>
        </Section>

        <Section title="Why rankings and playoff odds differ">
          <p>Power rankings answer a simple question: how strong does the model think each team is right now? Playoff projections answer a different one: how likely is that team to survive its actual schedule and conference race?</p>
          <p>A highly rated team can face a difficult path, while a slightly weaker team can benefit from its schedule or division. That is why ranking position, projected record, and playoff chance will not always line up.</p>
        </Section>

        <Section title="How the model changes during the season">
          <p>Completed games replace predictions with actual results. Team ratings and projections then respond to opponent quality and performance, while future matchups continue to use the latest available information.</p>
          <p>Each game’s displayed prediction is saved before kickoff so the Performance scorecard can judge the model fairly instead of rewriting history after the result is known.</p>
        </Section>

        <Section title="What the model does not try to do">
          <p>Pretzel Quest does not copy betting markets, expert power rankings, or fantasy projections. It also avoids grading every draft pick or routine roster move, where confident-looking adjustments can quickly become guesswork.</p>
          <p>The model cannot fully capture locker-room chemistry, scheme fit, weather surprises, or every injury. Rare manual adjustments are reserved for clearly important situations and are labeled on the Picks page.</p>
        </Section>
      </div>

      <section className="mt-8 rounded-2xl border border-amber-900/70 bg-amber-950/20 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
        <div>
          <h2 className="text-xl font-semibold text-amber-100">The fun part is disagreeing.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/70">Use the percentages as context, trust your own read, and see whether you can beat the model over a full season.</p>
        </div>
        <Link href="/week" className="mt-5 inline-flex shrink-0 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-gray-950 hover:bg-amber-300 sm:mt-0">Make your picks</Link>
      </section>
    </main>
  );
}
