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

function NavLink({
  href,
  label,
  onSelect,
}: {
  href: string;
  label: string;
  onSelect?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="block whitespace-nowrap rounded-lg px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800"
    >
      {label}
    </Link>
  );
}

export default function AppHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        // Supabase holds an auth lock while this callback runs. Defer any
        // follow-up API call so sign-in can finish before loading the profile.
        setTimeout(() => {
          void loadProfile(u);
        }, 0);
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
      <div className="mx-auto max-w-6xl px-4 py-3 lg:flex lg:items-center lg:justify-between lg:gap-4">
        <div className="flex items-center justify-between lg:shrink-0">
          <Link href="/" className="text-base font-semibold tracking-tight" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true" className="mr-1.5">🥨</span>
            Pretzel Quest
          </Link>
          <div className="ml-3 flex items-center gap-2 lg:hidden">
            {!user ? (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800"
              >
                Login
              </Link>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        <div
          id="site-menu"
          className={`${menuOpen ? "flex" : "hidden"} mt-3 flex-col gap-3 border-t border-gray-800 pt-3 lg:mt-0 lg:flex lg:flex-row lg:items-center lg:justify-end lg:border-0 lg:pt-0`}
        >
          <nav className="flex flex-col gap-1 lg:flex-row lg:items-center" aria-label="Primary">
            <NavLink href="/week" label="Picks" onSelect={() => setMenuOpen(false)} />
            <NavLink href="/my-picks" label="Season" onSelect={() => setMenuOpen(false)} />
            <NavLink href="/recap" label="Recap" onSelect={() => setMenuOpen(false)} />
            <NavLink href="/postseason" label="Postseason" onSelect={() => setMenuOpen(false)} />
            <NavLink href="/power-rankings" label="Model" onSelect={() => setMenuOpen(false)} />
            <NavLink href="/leaderboard" label="Leaderboard" onSelect={() => setMenuOpen(false)} />
            {isAdmin ? <NavLink href="/admin" label="Admin" onSelect={() => setMenuOpen(false)} /> : null}
          </nav>

          {user ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3 lg:border-0 lg:pt-0">
              <span className="mr-auto text-sm text-gray-400 lg:mr-0">
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
              <NavLink href="/profile" label="Profile" onSelect={() => setMenuOpen(false)} />
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="hidden rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 lg:inline-flex"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
