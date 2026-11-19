"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { DailyGame } from "@/lib/dailyGameScores";

export default function PostDailyScore({ game, result }: { game: DailyGame; result: object }) {
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState("");

  async function post() {
    setPosting(true);
    setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setNeedsLogin(true);
        setMessage("Sign in to post your result.");
        return;
      }
      const response = await fetch("/api/game-standings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ game, result }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNeedsLogin(response.status === 401);
        setMessage(data.error ?? "Your result couldn’t be posted. Try again.");
        return;
      }
      setPosted(true);
      setMessage(data.alreadyPosted ? "You already have a posted score for today." : "Score posted.");
    } catch {
      setMessage("Your result couldn’t be posted. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-gray-700 pt-4 text-sm">
      {!posted && <p className="mb-2">Post your score with your display name. One public result per account each day.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {!posted && !needsLogin && <button type="button" disabled={posting} onClick={post} className="rounded-lg border border-gray-600 px-3 py-2 font-semibold hover:bg-gray-800">
          {posting ? "Posting…" : "Post daily score"}
        </button>}
        {needsLogin && <Link href={`/login?next=/${game}`} className="text-amber-300 underline">Sign in</Link>}
        <Link href={`/leaderboard?game=${game}`} className="text-amber-300 underline">View daily leaderboard</Link>
      </div>
      <p className="mt-2" role="status">{message}</p>
    </div>
  );
}
