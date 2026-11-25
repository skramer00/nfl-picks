"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { DailyGame } from "@/lib/dailyGameScores";

type PostingStatus = {
  state: "posting" | "posted" | "sign-in" | "failed" | "expired";
  message: string;
};

export default function PostDailyScore({ game, result }: { game: DailyGame; result: object }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<PostingStatus>({ state: "posting", message: "Posting your daily score…" });
  // The parent may create a new result object when unrelated UI state changes.
  const payload = JSON.stringify({ game, result });

  useEffect(() => {
    const controller = new AbortController();
    function report(next: PostingStatus) {
      if (!controller.signal.aborted) setStatus(next);
    }

    async function post() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        if (error) throw error;
        if (!session) {
          report({ state: "sign-in", message: "Sign in to add today’s result to the leaderboard." });
          return;
        }

        const response = await fetch("/api/game-standings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: payload,
          keepalive: true,
        });
        const data = await response.json();
        if (!response.ok) {
          const state = response.status === 401 ? "sign-in" : response.status === 409 ? "expired" : "failed";
          report({ state, message: data.error ?? "Your result couldn’t be posted." });
          return;
        }
        report({ state: "posted", message: data.alreadyPosted ? "Your score for this daily challenge is already on the leaderboard." : "Score posted to the daily leaderboard." });
      } catch {
        report({ state: "failed", message: "Your result couldn’t be posted. Try again." });
      }
    }

    void post();
    return () => controller.abort();
  }, [payload, attempt]);

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 text-sm">
      <p className="mb-2" role="status">{status.message}</p>
      <div className="flex flex-wrap items-center gap-3">
        {status.state === "failed" && (
          <button type="button" className="action-secondary" onClick={() => {
            setStatus({ state: "posting", message: "Posting your daily score…" });
            setAttempt((count) => count + 1);
          }}>Retry posting</button>
        )}
        {status.state === "sign-in" && <Link href={`/login?next=/${game}`} className="text-amber-300 underline">Sign in</Link>}
        <Link href={`/leaderboard?game=${game}`} className="text-amber-300 underline">View daily leaderboard</Link>
      </div>
    </div>
  );
}
