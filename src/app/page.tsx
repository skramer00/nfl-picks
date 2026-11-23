"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-2xl border border-gray-800 bg-[radial-gradient(ellipse_at_top_right,#422006_0%,#111827_42%,#030712_80%)] p-6 sm:p-10">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">NFL picks and football games</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-200">
          Make weekly picks, see how you stack up against the model, or play a football challenge anytime.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/week" className="action-primary">Open Weekly Picks</Link>
          <Link href="#games" className="action-secondary">Explore games</Link>
          {signedIn === false && <Link href="/login?mode=signup" className="action-secondary">Sign up</Link>}
        </div>
      </section>

      <section id="games" aria-labelledby="games-heading" className="mt-8 scroll-mt-24">
        <h2 id="games-heading" className="text-2xl font-bold">Football games</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {games.map(({ href, title, description }) => <Feature key={href} href={href} title={title} description={description} />)}
        </div>
      </section>

      <section aria-labelledby="season-heading" className="mt-8">
        <h2 id="season-heading" className="text-2xl font-bold">Follow the NFL season</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {features.map(({ href, title, description }) => <Feature key={href} href={href} title={title} description={description} />)}
        </div>
      </section>
    </main>
  );
}

const games = [
  { href: "/draft-duel", title: "Draft Duel", description: "Draft a fantasy lineup from 32 franchises and take on the computer. Every card shows its scoring average." },
  { href: "/roster-rescue", title: "Roster Rescue", description: "Make up to three swaps to improve a fantasy lineup, then see how close you came to the best possible roster." },
  { href: "/two-minute-drill", title: "Two-Minute Drill", description: "Call plays and manage timeouts to drive 65 yards for a touchdown. The play options show the yardage, time, and risk." },
];

const features = [
  { href: "/my-picks", title: "Season Summary", description: "Review your picks, accuracy, and weekly recaps." },
  { href: "/power-rankings", title: "Model Center", description: "Explore team rankings, matchup probabilities, and how the model has performed." },
  { href: "/postseason", title: "Postseason", description: "See the projected playoff field and how your picks could change it." },
  { href: "/leaderboard", title: "Leaderboard", description: "Check overall NFL Picks standings, private pools, and daily game standings for Draft Duel and Roster Rescue." },
];

function Feature({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-gray-800 bg-gray-950 p-4 transition-colors hover:border-amber-400 hover:bg-gray-900 sm:p-5">
      <h3 className="text-lg font-semibold text-amber-300">{title}</h3>
      <p className="mt-2 leading-relaxed text-gray-300">{description}</p>
    </Link>
  );
}
