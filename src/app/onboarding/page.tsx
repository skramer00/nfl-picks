"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { supabase } from "@/lib/supabaseClient";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          if (!cancelled) setSignedOut(true);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, onboarding_completed_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (data?.onboarding_completed_at) {
          router.replace("/week/1");
          return;
        }
        setUserId(user.id);
        setDisplayName(data?.display_name ?? user.email?.split("@")[0] ?? "");
      } catch (error) {
        if (!cancelled) setStatus(`Unable to start onboarding: ${errorMessage(error)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !displayName.trim()) return;
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw error;
      window.location.assign("/week/1");
    } catch (error) {
      setStatus(`Save failed: ${errorMessage(error)}`);
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-gray-400">Setting up your season…</main>;
  if (signedOut) {
    return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-semibold">Log in to continue</h1><Link href="/login" className="mt-5 inline-block text-blue-300 underline">Go to login</Link></main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">Welcome to Pretzel Quest</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">Let’s set up your season.</h1>
      <p className="mt-3 text-gray-400">One quick step, then you’re ready to make picks.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="How Pretzel Quest works">
        <Info number="1" title="Make your picks" text="Choose a winner for every matchup before kickoff." />
        <Info number="2" title="Read the model" text="Favorability combines team strength, venue, division context, and rest." />
        <Info number="3" title="Score points" text="Earn points for picks, correct calls, and underdog wins." />
      </section>

      {status ? <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-200" role="alert">{status}</div> : null}
      <form onSubmit={finish} className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <label className="block text-sm text-gray-300">
          Display name
          <input required maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 text-white" autoComplete="nickname" />
        </label>
        <p className="mt-2 text-xs text-gray-500">This is the name other players will see on the leaderboard.</p>
        <button disabled={saving || !displayName.trim()} type="submit" className="mt-5 w-full rounded-xl bg-amber-400 py-3 font-semibold text-gray-950 hover:bg-amber-300 disabled:opacity-50">
          {saving ? "Saving…" : "Start making picks"}
        </button>
      </form>
    </main>
  );
}

function Info({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5"><span className="text-sm font-bold text-amber-400">{number}</span><h2 className="mt-2 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-gray-400">{text}</p></div>;
}
