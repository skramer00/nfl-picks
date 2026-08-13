"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import { SharedPredictionsManager } from "@/components/SharedPredictionsManager";
import { getMyShares, type SharedPrediction } from "@/lib/sharedPredictions";
import { ReminderSettings } from "@/components/ReminderSettings";

type Profile = { display_name: string | null };

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Something went wrong.";
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [shares, setShares] = useState<SharedPrediction[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!user) {
          setSignedOut(true);
          return;
        }
        if (userError) throw userError;

        setUserId(user.id);
        const [profileResult, savedShares] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
          getMyShares(user.id),
        ]);
        const { data, error } = profileResult;
        if (error) throw error;

        const profile = data as unknown as Profile | null;
        setDisplayName(profile?.display_name ?? user.email?.split("@")[0] ?? "");
        setShares(savedShares);
      } catch (error) {
        setStatus(`Load failed: ${messageFrom(error)}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save() {
    if (!userId) {
      setStatus("Please log in to edit your profile.");
      return;
    }

    const name = displayName.trim();
    if (!name) {
      setStatus("Display name can’t be empty.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("user_id", userId);
      if (error) throw error;
      const { error: shareError } = await supabase.from("shared_predictions").update({ display_name: name, updated_at: new Date().toISOString() }).eq("user_id", userId);
      if (shareError) throw shareError;
      setShares((current) => current.map((share) => ({ ...share, display_name: name, updated_at: new Date().toISOString() })));
      setStatus("Profile updated successfully.");
    } catch (error) {
      setStatus(`Save failed: ${messageFrom(error)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-md p-6">Loading profile…</main>;

  if (signedOut) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-3xl font-semibold">Profile</h1>
        <div className="mt-4 rounded-xl border border-blue-900 bg-blue-950/30 p-5">
          <h2 className="font-semibold text-blue-100">Log in to manage your profile</h2>
          <p className="mt-2 text-sm text-gray-300">Sign in to update the name shown throughout NFL Picks.</p>
          <Link href="/login" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-semibold">Profile</h1>
      {status && <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm" role="status">{status}</div>}
      {userId && (
        <div className="mt-6 max-w-md space-y-4">
          <label className="block text-sm text-gray-300">
            Display name
            <input maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white" />
          </label>
          <button onClick={save} disabled={saving} className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-500 disabled:opacity-50" type="button">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      )}
      {userId ? <SharedPredictionsManager userId={userId} initialShares={shares} /> : null}
      {userId ? <ReminderSettings userId={userId} /> : null}
    </main>
  );
}
