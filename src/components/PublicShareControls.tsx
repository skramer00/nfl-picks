"use client";

import { useState } from "react";
import type { SharedPrediction } from "@/lib/sharedPredictions";

export function PublicShareControls({ share, path, onPublish, onRegenerate, onRevoke }: {
  share: SharedPrediction | null;
  path: "rankings" | "playoffs";
  onPublish: () => Promise<SharedPrediction>;
  onRegenerate: () => Promise<SharedPrediction>;
  onRevoke: () => Promise<SharedPrediction>;
}) {
  const [current, setCurrent] = useState(share);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const url = current?.is_public && typeof window !== "undefined" ? `${window.location.origin}/shared/${path}/${current.public_token}` : "";
  async function run(action: () => Promise<SharedPrediction>, message: string) {
    setBusy(true); setStatus("");
    try { setCurrent(await action()); setStatus(message); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to update sharing."); }
    finally { setBusy(false); }
  }
  async function copy() { await navigator.clipboard.writeText(url); setStatus("Link copied"); }
  async function shareLink() {
    if (navigator.share) await navigator.share({ title: "Pretzel Quest prediction", url });
    else await copy();
  }
  if (!current?.is_public) return <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950 p-4"><p className="text-sm text-gray-400">Private by default. Publish only when you want a read-only link anyone can view.</p><button type="button" disabled={busy} onClick={() => void run(onPublish, "Public link created")} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Create public link</button>{status ? <p className="mt-2 text-xs text-gray-400" role="status">{status}</p> : null}</div>;
  return <div className="mt-4 rounded-xl border border-emerald-900 bg-emerald-950/20 p-4"><p className="text-sm font-semibold text-emerald-200">Public read-only link</p><p className="mt-1 truncate text-xs text-gray-400">{url}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copy()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold">Copy link</button><button type="button" onClick={() => void shareLink()} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Share</button><button type="button" disabled={busy} onClick={() => void run(onPublish, "Shared page updated")} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Update</button><button type="button" disabled={busy} onClick={() => void run(onRegenerate, "A new link was created")} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">New link</button><button type="button" disabled={busy} onClick={() => void run(onRevoke, "Public link revoked")} className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300">Revoke</button></div>{status ? <p className="mt-2 text-xs text-gray-400" role="status">{status}</p> : null}</div>;
}
