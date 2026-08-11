import { supabase } from "@/lib/supabaseClient";
import type { LeaderboardRow } from "@/lib/leaderboardDb";

export type Pool = { pool_id: string; name: string; owner_id: string; invite_code: string; invite_enabled: boolean; role: string; member_count: number };
export type PoolMember = { user_id: string; display_name: string; role: string; joined_at: string };

function unwrap<T>(data: T | null, error: { message: string } | null) { if (error) throw new Error(error.message); return data; }
export async function getMyPools() { const { data, error } = await supabase.rpc("get_my_pools"); return (unwrap(data, error) ?? []) as Pool[]; }
export async function createPool(name: string) { const { data, error } = await supabase.rpc("create_pool", { p_name: name }); return unwrap(data, error) as string; }
export async function joinPool(code: string) { const { data, error } = await supabase.rpc("join_pool", { p_invite_code: code }); return unwrap(data, error) as string; }
export async function getPoolMembers(poolId: string) { const { data, error } = await supabase.rpc("get_pool_members", { p_pool_id: poolId }); return (unwrap(data, error) ?? []) as PoolMember[]; }
export async function getPoolStandings(poolId: string, week?: number) { const { data, error } = await supabase.rpc("get_pool_standings", { p_pool_id: poolId, ...(week ? { p_week: week } : {}) }); return (unwrap(data, error) ?? []) as LeaderboardRow[]; }
export async function setPoolInvites(poolId: string, enabled: boolean) { const { error } = await supabase.rpc("set_pool_invites", { p_pool_id: poolId, p_enabled: enabled }); if (error) throw new Error(error.message); }
export async function regeneratePoolInvite(poolId: string) { const { data, error } = await supabase.rpc("regenerate_pool_invite", { p_pool_id: poolId }); return unwrap(data, error) as string; }
export async function removePoolMember(poolId: string, userId: string) { const { error } = await supabase.rpc("remove_pool_member", { p_pool_id: poolId, p_user_id: userId }); if (error) throw new Error(error.message); }
