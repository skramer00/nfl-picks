"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getLeaderboard, type LeaderboardRow } from "@/lib/leaderboardDb";
import { createPool, getMyPools, getPoolMembers, getPoolStandings, joinPool, regeneratePoolInvite, removePoolMember, setPoolInvites, type Pool, type PoolMember } from "@/lib/poolsDb";
import { supabase } from "@/lib/supabaseClient";

function medal(rank: number) { return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : ""; }

function Standings({ rows }: { rows: LeaderboardRow[] }) {
  if (!rows.length) return <div className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-sm text-gray-400">No standings yet.</div>;
  return <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950"><table className="w-full min-w-[650px] text-sm"><thead className="bg-gray-900 text-xs text-gray-400"><tr><th className="px-4 py-3 text-left">Rank</th><th className="px-4 py-3 text-left">Player</th><th className="px-4 py-3 text-right">Points</th><th className="px-4 py-3 text-right">Correct</th><th className="px-4 py-3 text-right">Picks</th><th className="px-4 py-3 text-right">Accuracy</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.user_id} className="border-t border-gray-900"><td className="px-4 py-3 font-semibold">{medal(index + 1)} {index + 1}</td><td className="px-4 py-3 font-medium">{row.display_name}</td><td className="px-4 py-3 text-right font-semibold text-blue-300">{row.points}</td><td className="px-4 py-3 text-right">{row.correct}</td><td className="px-4 py-3 text-right">{row.picks_made}</td><td className="px-4 py-3 text-right">{row.final_picks ? `${row.accuracy}%` : "—"}</td></tr>)}</tbody></table></div>;
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [selected, setSelected] = useState("overall");
  const [week, setWeek] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [poolName, setPoolName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const activePool = pools.find((pool) => pool.pool_id === selected) ?? null;

  async function refreshPools(selectId?: string) { const next = await getMyPools(); setPools(next); if (selectId) setSelected(selectId); return next; }
  useEffect(() => { let cancelled = false; async function load() { try { const code = new URLSearchParams(window.location.search).get("invite"); if (code) setInviteCode(code.toUpperCase().slice(0, 8)); const [{ data }, overall] = await Promise.all([supabase.auth.getUser(), getLeaderboard()]); if (cancelled) return; setUserId(data.user?.id ?? null); setRows(overall); if (data.user) setPools(await getMyPools()); } catch (error) { if (!cancelled) setStatus(error instanceof Error ? error.message : "Unable to load standings."); } finally { if (!cancelled) setLoading(false); } } void load(); return () => { cancelled = true; }; }, []);
  useEffect(() => { if (selected === "overall") { void getLeaderboard().then(setRows); setMembers([]); return; } let cancelled = false; Promise.all([getPoolStandings(selected, week || undefined), getPoolMembers(selected)]).then(([nextRows, nextMembers]) => { if (!cancelled) { setRows(nextRows); setMembers(nextMembers); } }).catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Unable to load pool."); }); return () => { cancelled = true; }; }, [selected, week]);

  async function create(event: FormEvent) { event.preventDefault(); setStatus(""); try { const id = await createPool(poolName); await refreshPools(id); setPoolName(""); setStatus("Pool created. Share its invite link when you’re ready."); } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to create pool."); } }
  async function join(event: FormEvent) { event.preventDefault(); setStatus(""); try { const id = await joinPool(inviteCode); await refreshPools(id); setInviteCode(""); setStatus("You joined the pool."); } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to join pool."); } }
  async function toggleInvites() { if (!activePool) return; await setPoolInvites(activePool.pool_id, !activePool.invite_enabled); await refreshPools(activePool.pool_id); }
  async function newInvite() { if (!activePool) return; await regeneratePoolInvite(activePool.pool_id); await refreshPools(activePool.pool_id); setStatus("A new invite link was created. The old one no longer works."); }
  async function remove(member: PoolMember) { if (!activePool) return; await removePoolMember(activePool.pool_id, member.user_id); setMembers(await getPoolMembers(activePool.pool_id)); setRows(await getPoolStandings(activePool.pool_id, week || undefined)); setStatus(`${member.display_name} was removed.`); }
  async function copyInvite() { if (!activePool) return; await navigator.clipboard.writeText(`${window.location.origin}/leaderboard?invite=${activePool.invite_code}`); setStatus("Invite link copied."); }

  return <main className="mx-auto max-w-5xl p-6"><div className="max-w-3xl"><p className="text-sm font-medium uppercase tracking-widest text-blue-400">Standings</p><h1 className="mt-1 text-3xl font-semibold">Leaderboard</h1><p className="mt-2 text-sm text-gray-400">{selected === "overall" ? "1 point per pick • +1 correct • playoff rounds multiply" : "Pool standings count picks only after kickoff, keeping future selections private."}</p></div>
    {status ? <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm" role="status">{status}</div> : null}
    {loading ? <div className="mt-6 rounded-xl border border-gray-800 p-6">Loading standings…</div> : <>
      <div className="mt-6 flex flex-wrap items-end gap-3"><label className="min-w-56 text-sm text-gray-300">Leaderboard<select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white"><option value="overall">Overall</option>{pools.map((pool) => <option key={pool.pool_id} value={pool.pool_id}>{pool.name} ({pool.member_count})</option>)}</select></label>{selected !== "overall" ? <label className="text-sm text-gray-300">View<select value={week} onChange={(event) => setWeek(Number(event.target.value))} className="mt-1 block rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white"><option value={0}>Season</option>{Array.from({ length: 18 }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}</select></label> : null}</div>
      <div className="mt-6"><Standings rows={rows} /></div>
      {!userId ? <div className="mt-8 rounded-xl border border-blue-900 bg-blue-950/30 p-5"><h2 className="font-semibold">Log in to create or join a pool</h2><Link href={inviteCode ? `/login?next=${encodeURIComponent(`/leaderboard?invite=${inviteCode}`)}` : "/login"} className="mt-3 inline-block text-blue-300 underline">Log in</Link></div> : <>
        {activePool ? <section className="mt-8 rounded-2xl border border-gray-800 bg-gray-950 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-amber-400">Private pool</p><h2 className="mt-1 text-2xl font-semibold">{activePool.name}</h2><p className="mt-1 text-sm text-gray-500">{activePool.member_count} member{activePool.member_count === 1 ? "" : "s"}</p></div>{activePool.invite_enabled ? <button type="button" onClick={() => void copyInvite()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Copy invite link</button> : <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-gray-400">Invites disabled</span>}</div>
          {activePool.role === "owner" ? <div className="mt-5 border-t border-gray-800 pt-5"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void toggleInvites()} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">{activePool.invite_enabled ? "Disable invites" : "Enable invites"}</button><button type="button" onClick={() => void newInvite()} className="rounded-lg border border-gray-700 px-3 py-2 text-sm">Create new invite</button></div><h3 className="mt-6 font-semibold">Members</h3><div className="mt-3 space-y-2">{members.map((member) => <div key={member.user_id} className="flex items-center justify-between rounded-lg border border-gray-800 p-3"><div><span className="font-medium">{member.display_name}</span><span className="ml-2 text-xs text-gray-500">{member.role}</span></div>{member.role !== "owner" ? <button type="button" onClick={() => void remove(member)} className="text-sm text-red-300">Remove</button> : null}</div>)}</div></div> : null}
        </section> : null}
        <section className="mt-8 grid gap-4 md:grid-cols-2"><form onSubmit={create} className="rounded-2xl border border-gray-800 bg-gray-950 p-5"><h2 className="text-lg font-semibold">Create a pool</h2><p className="mt-1 text-sm text-gray-400">Start a private leaderboard for friends or family.</p><input required minLength={2} maxLength={50} value={poolName} onChange={(event) => setPoolName(event.target.value)} placeholder="Pool name" className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-900 p-3" /><button className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 font-semibold" type="submit">Create pool</button></form><form onSubmit={join} className="rounded-2xl border border-gray-800 bg-gray-950 p-5"><h2 className="text-lg font-semibold">Join a pool</h2><p className="mt-1 text-sm text-gray-400">Enter the eight-character code from an invitation.</p><input required minLength={8} maxLength={8} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="AB12CD34" className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 uppercase tracking-widest" /><button className="mt-3 w-full rounded-lg border border-gray-700 py-2.5 font-semibold" type="submit">Join pool</button></form></section>
      </>}
    </>}
  </main>;
}
