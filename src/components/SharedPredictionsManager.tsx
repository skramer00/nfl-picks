"use client";

import Link from "next/link";
import { useState } from "react";
import { revokeShare, type SharedPrediction } from "@/lib/sharedPredictions";

const DETAILS = {
  power_rankings: { label: "Power Rankings", path: "rankings", manage: "/power-rankings" },
  playoffs_model: { label: "Model Playoff Prediction", path: "playoffs", manage: "/postseason" },
  playoffs_user: { label: "My Picks Playoff Prediction", path: "playoffs", manage: "/postseason" },
} as const;

export function SharedPredictionsManager({ userId, initialShares }: { userId: string; initialShares: SharedPrediction[] }) {
  const [shares, setShares] = useState(initialShares);
  const [status, setStatus] = useState("");
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const published = shares.filter((share) => share.is_public);

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setStatus("Link copied");
  }

  async function revoke(share: SharedPrediction) {
    setBusyKind(share.kind); setStatus("");
    try {
      const next = await revokeShare(userId, share.kind);
      setShares((current) => current.map((item) => item.kind === next.kind ? next : item));
      setStatus(`${DETAILS[share.kind].label} link revoked.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to revoke the link.");
    } finally {
      setBusyKind(null);
    }
  }

  return <section className="mt-10 border-t border-gray-800 pt-8" aria-labelledby="shared-predictions-heading">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Sharing</p><h2 id="shared-predictions-heading" className="mt-1 text-2xl font-semibold">My Shared Predictions</h2><p className="mt-2 text-sm text-gray-400">Manage the read-only links you have intentionally published.</p></div>
    {status ? <p className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm" role="status">{status}</p> : null}
    {published.length ? <div className="mt-5 space-y-3">{published.map((share) => {
      const details = DETAILS[share.kind];
      const url = `/shared/${details.path}/${share.public_token}`;
      return <article key={share.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{details.label}</h3><p className="mt-1 text-xs text-gray-500">Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(share.updated_at))}</p></div><span className="rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-300">Public</span></div><p className="mt-3 truncate text-xs text-gray-500">{url}</p><div className="mt-3 flex flex-wrap gap-2"><a href={url} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold">Open</a><button type="button" onClick={() => void copy(`${window.location.origin}${url}`)} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Copy link</button><Link href={details.manage} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Update prediction</Link><button type="button" disabled={busyKind === share.kind} onClick={() => void revoke(share)} className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 disabled:opacity-50">Revoke</button></div></article>;
    })}</div> : <div className="mt-5 rounded-xl border border-dashed border-gray-800 p-5"><p className="text-sm text-gray-400">You have no public prediction links. Rankings and playoff predictions stay private until you publish them.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/power-rankings" className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Power Rankings</Link><Link href="/postseason" className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Postseason</Link></div></div>}
  </section>;
}
