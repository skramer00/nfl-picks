import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createHash } from "node:crypto";
import { parse } from "csv-parse";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { efficiencyTeam, type EfficiencyObservation } from "./efficiencyModel";

export const efficiencySource = (season: number) => `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${season}.csv.gz`;
type CompletedGame = { id: string; week: number; kickoff_at: string; status: string; away_team: { abbreviation: string }; home_team: { abbreviation: string } };
export function aggregateEfficiency(plays: Record<string, string>[], games: CompletedGame[], season: number, observedAt: Date) {
  const schedule = new Map(games.filter((g) => g.status === "final" && Date.parse(g.kickoff_at) + 24 * 3600000 < observedAt.getTime())
    .map((g) => [`${g.week}:${efficiencyTeam(g.away_team.abbreviation)}:${efficiencyTeam(g.home_team.abbreviation)}`, g]));
  const totals = new Map<string, EfficiencyObservation>();
  for (const p of plays) {
    if (p.season_type !== "REG" || !["pass", "run"].includes(p.play_type) || p.special_teams_play === "1" || p.qb_kneel === "1" || p.qb_spike === "1" || p.no_play === "1") continue;
    const game = schedule.get(`${p.week}:${efficiencyTeam(p.away_team)}:${efficiencyTeam(p.home_team)}`);
    const epa = Number(p.epa); const team = efficiencyTeam(p.posteam); const opponent = efficiencyTeam(p.defteam);
    if (!game || !p.epa || !Number.isFinite(epa) || !["0", "1"].includes(p.success) || !team || !opponent || team === opponent ||
      ![game.away_team.abbreviation, game.home_team.abbreviation].map(efficiencyTeam).includes(team) ||
      ![game.away_team.abbreviation, game.home_team.abbreviation].map(efficiencyTeam).includes(opponent)) continue;
    const key = `${game.id}:${team}`;
    const row = totals.get(key) ?? { game_id: game.id, season, week: game.week, team, opponent,
      kickoff_at: game.kickoff_at, observed_at: observedAt.toISOString(), content_hash: "", source: efficiencySource(season),
      plays: 0, epa: 0, successes: 0, pass_plays: 0, pass_epa: 0, rush_plays: 0, rush_epa: 0 };
    row.plays++; row.epa += epa; row.successes += Number(p.success);
    if (p.play_type === "pass") { row.pass_plays++; row.pass_epa += epa; }
    else { row.rush_plays++; row.rush_epa += epa; }
    totals.set(key, row);
  }
  // Require both offenses and a reasonable sample; incomplete provider games
  // are retried on the next refresh instead of publishing partial team strength.
  return [...totals.values()].filter((row) => row.plays >= 20 && (totals.get(`${row.game_id}:${row.opponent}`)?.plays ?? 0) >= 20).map((row) => {
    row.epa = Number(row.epa.toFixed(6)); row.pass_epa = Number(row.pass_epa.toFixed(6)); row.rush_epa = Number(row.rush_epa.toFixed(6));
    row.content_hash = createHash("sha256").update(JSON.stringify([row.plays, row.epa, row.successes, row.pass_plays, row.pass_epa, row.rush_plays, row.rush_epa])).digest("hex");
    return row;
  });
}

export async function fetchEfficiencyPlays(season: number) {
  const response = await fetch(efficiencySource(season), { cache: "no-store", signal: AbortSignal.timeout(45000) });
  if (!response.ok || !response.body) throw new Error(`nflverse returned ${response.status}`);
  const compressed = Buffer.from(await response.arrayBuffer());
  if (compressed.length > 35_000_000) throw new Error("Efficiency source exceeds compressed size limit");
  const parser = parse({ columns: true, bom: true, skip_empty_lines: true, max_record_size: 100000 });
  const completed = pipeline(Readable.from(compressed), createGunzip(), parser).catch((error: Error) => { parser.destroy(error); });
  const plays: Record<string, string>[] = [];
  for await (const row of parser) {
    if (plays.length >= 70000) throw new Error("Efficiency source exceeds season play limit");
    // Keep only the fields needed for aggregation, not the 300-column source.
    plays.push(Object.fromEntries(["season_type", "week", "away_team", "home_team", "posteam", "defteam", "play_type", "special_teams_play", "qb_kneel", "qb_spike", "no_play", "epa", "success"].map((key) => [key, row[key] ?? ""])));
  }
  await completed;
  return plays;
}

export async function refreshEfficiency(supabase: SupabaseClient<Database>, season: number, force = false) {
  const now = new Date();
  const { data: previous, error: previousError } = await supabase.from("model_data_refreshes").select("*").eq("season", season).eq("source", "nflverse").maybeSingle();
  if (previousError) throw previousError;
  const interval = previous?.status === "success" ? 6 * 3600000 : 3600000;
  if (!force && previous && now.getTime() - Date.parse(previous.attempted_at) < interval) return { skipped: true, rows: previous.row_count };
  const { error: startError } = await supabase.from("model_data_refreshes").upsert({ season, source: "nflverse", attempted_at: now.toISOString(), status: "running", row_count: 0, error: null });
  if (startError) throw startError;
  try {
    const { data, error } = await supabase.from("games").select("id, week, kickoff_at, status, away_team:teams!games_away_team_id_fkey(abbreviation), home_team:teams!games_home_team_id_fkey(abbreviation)").eq("season", season).eq("season_type", "REG");
    if (error) throw error;
    const plays = await fetchEfficiencyPlays(season);
    const observedAt = new Date();
    const rows = aggregateEfficiency(plays, data as unknown as CompletedGame[], season, observedAt);
    if (!rows.length) throw new Error("No completed games with usable efficiency data");
    const { error: writeError } = await supabase.from("model_efficiency_observations").upsert(rows, { onConflict: "game_id,team,content_hash", ignoreDuplicates: true });
    if (writeError) throw writeError;
    const { error: doneError } = await supabase.from("model_data_refreshes").upsert({ season, source: "nflverse", attempted_at: observedAt.toISOString(), status: "success", row_count: rows.length, error: null });
    if (doneError) throw doneError;
    return { skipped: false, rows: rows.length };
  } catch (error) {
    await supabase.from("model_data_refreshes").upsert({ season, source: "nflverse", attempted_at: new Date().toISOString(), status: "error", row_count: 0, error: error instanceof Error ? error.message : "Unknown source failure" });
    throw error;
  }
}

export async function getEfficiencyObservations(supabase: SupabaseClient<Database>, season: number) {
  const rows: EfficiencyObservation[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("model_efficiency_observations").select("*").eq("season", season).order("game_id").order("team").order("observed_at").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
