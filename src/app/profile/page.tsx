"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

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

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          setStatus("Please log in to edit your profile.");
          return;
        }

        setUserId(user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;

        const profile = data as unknown as Profile | null;
        setDisplayName(profile?.display_name ?? user.email?.split("@")[0] ?? "");
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
      setStatus("Profile updated successfully.");
    } catch (error) {
      setStatus(`Save failed: ${messageFrom(error)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-md p-6">Loading profile…</main>;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-3xl font-semibold">Profile</h1>
      {status && <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm" role="status">{status}</div>}
      {userId && (
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-gray-300">
            Display name
            <input maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white" />
          </label>
          <button onClick={save} disabled={saving} className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-500 disabled:opacity-50" type="button">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      )}
    </main>
  );
}
