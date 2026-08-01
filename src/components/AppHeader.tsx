"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  is_admin: boolean | null;
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
    >
      {label}
    </Link>
  );
}

export default function AppHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadProfile(u: User | null) {
    if (!u) {
      setDisplayName("");
      setIsAdmin(false);
      return;
    }

    const fallback = u.email?.split("@")[0] ?? "User";

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, is_admin")
      .eq("user_id", u.id)
      .maybeSingle();

    const typedProfile = profile as unknown as ProfileRow | null;

    if (error || !typedProfile) {
      setDisplayName(fallback);
      setIsAdmin(false);
      return;
    }

    setDisplayName(typedProfile.display_name ?? fallback);
    setIsAdmin(Boolean(typedProfile.is_admin));
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user ?? null;
      setUser(u);
      loadProfile(u);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await loadProfile(u);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const userLabel =
    displayName || (user?.email ? user.email.split("@")[0] : "User");

  return (
    <header className="sticky top-0 z-10 border-b border-gray-800 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          NFL Picks
          <span className="ml-2 text-xs font-normal text-gray-400">2026</span>
        </Link>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1">
            <NavLink href="/week" label="Make Picks" />
            <NavLink href="/my-picks" label="My Season" />
            <NavLink href="/postseason" label="Postseason" />
            <NavLink href="/power-rankings" label="Rankings" />
            <NavLink href="/leaderboard" label="Leaderboard" />
            {isAdmin ? <NavLink href="/admin" label="Admin" /> : null}
          </nav>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-gray-400 sm:inline">
                {userLabel}
              </span>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.assign("/");
                }}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
              >
                Logout
              </button>
              <NavLink href="/profile" label="Profile" />
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
