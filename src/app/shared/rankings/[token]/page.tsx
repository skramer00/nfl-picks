import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicShare } from "@/lib/sharedPredictionsServer";
import { getTeamTheme } from "@/lib/teamColors";

type Team = { abbreviation: string; name: string };
async function load(token: string) { return getPublicShare(token, "power_rankings"); }

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params; const share = await load(token);
  if (!share) return { title: "Shared ranking not found | Pretzel Quest" };
  return { title: `${share.display_name}'s NFL Power Rankings | Pretzel Quest`, description: `See ${share.display_name}'s complete 2026 NFL power rankings.`, robots: { index: false, follow: false }, openGraph: { title: `${share.display_name}'s NFL Power Rankings`, description: "All 32 teams, ranked on Pretzel Quest.", images: [`/shared/rankings/${token}/opengraph-image`] } };
}

export default async function SharedRankingsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const share = await load(token); if (!share) notFound();
  const teams = (share.payload as { teams?: Team[] }).teams ?? []; if (teams.length !== 32) notFound();
  return <main className="mx-auto max-w-3xl p-6"><p className="text-sm font-medium uppercase tracking-widest text-amber-400">🥨 Pretzel Quest</p><h1 className="mt-2 text-3xl font-semibold">{share.display_name}&apos;s Power Rankings</h1><p className="mt-2 text-sm text-gray-500">Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(share.updated_at))} · Read-only</p><div className="mt-8 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">{teams.map((team, index) => { const theme = getTeamTheme(team.abbreviation); return <div key={team.abbreviation} className="grid grid-cols-[2.5rem_3.5rem_minmax(0,1fr)] items-center gap-3 border-b border-gray-900 px-4 py-3 last:border-0"><span className="text-lg font-bold text-gray-500">{index + 1}</span><span className="flex h-9 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: theme.primary }}>{team.abbreviation}</span><span className="font-semibold">{team.name}</span></div>; })}</div></main>;
}
