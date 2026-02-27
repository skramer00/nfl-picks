import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFL Picks",
  description: "Pick games. Track accuracy. Climb the leaderboard.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight">
              NFL Picks
              <span className="ml-2 text-xs font-normal text-gray-400">2026</span>
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink href="/week/1" label="Week" />
              <NavLink href="/my-picks" label="My Picks" />
              <NavLink href="/leaderboard" label="Leaderboard" />
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}