import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "./database.types";
import { gameDayIncidentKey, type GameDayAlertType } from "./gameDayAlertLogic";
import { gameDayHealth, type OperationsGame, type OperationsSyncRun } from "./operationsHealth";
import { getResend, operationalAlertHtml } from "./resend";

const ADMIN_URL = "https://pretzel.quest/admin";

type AdminClient = SupabaseClient<Database>;
type AlertGame = OperationsGame & {
  away_team: { abbreviation: string };
  home_team: { abbreviation: string };
};

type AlertInput = {
  type: GameDayAlertType;
  season: number;
  subjects: string[];
  title: string;
  summary: string;
  details: string[];
  now: Date;
};

async function adminRecipients(admin: AdminClient) {
  const [{ data: profiles, error: profileError }, usersResult] = await Promise.all([
    admin.from("profiles").select("user_id").eq("is_admin", true),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profileError) throw profileError;
  if (usersResult.error) throw usersResult.error;
  const adminIds = new Set((profiles ?? []).map((profile) => profile.user_id));
  return usersResult.data.users
    .filter((user) => adminIds.has(user.id) && user.email)
    .map((user) => user.email!);
}

async function sendAlert(admin: AdminClient, input: AlertInput) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !fromEmail) {
    console.warn("Game-day alert skipped because Resend is not configured.");
    return { sent: false, configured: false, deduplicated: false };
  }

  const incidentKey = gameDayIncidentKey(input);
  const { error: insertError } = await admin.from("game_day_alert_deliveries").insert({
    incident_key: incidentKey,
    incident_type: input.type,
    season: input.season,
    details: { summary: input.summary, details: input.details } as Json,
  });
  if (insertError?.code === "23505") {
    return { sent: false, configured: true, deduplicated: true };
  }
  if (insertError) throw insertError;

  try {
    const recipients = await adminRecipients(admin);
    if (!recipients.length) throw new Error("No administrator email address is available.");
    const result = await getResend().emails.send(
      {
        from: `Pretzel Quest <${fromEmail}>`,
        to: recipients,
        subject: `Pretzel Quest alert: ${input.title}`,
        html: operationalAlertHtml({ title: input.title, summary: input.summary, details: input.details, adminUrl: ADMIN_URL }),
      },
      { headers: { "Idempotency-Key": incidentKey } }
    );
    if (result.error) throw new Error(result.error.message);
    await admin.from("game_day_alert_deliveries").update({
      status: "sent",
      resend_email_id: result.data?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq("incident_key", incidentKey);
    return { sent: true, configured: true, deduplicated: false };
  } catch (error) {
    await admin.from("game_day_alert_deliveries").update({
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown email error",
      updated_at: new Date().toISOString(),
    }).eq("incident_key", incidentKey);
    throw error;
  }
}

async function loadHealth(admin: AdminClient, season: number, now: Date) {
  const [{ data: games, error: gamesError }, { data: runs, error: runsError }] = await Promise.all([
    admin.from("games").select("id, week, kickoff_at, status, away_score, home_score, winner_team_id, away_team:teams!games_away_team_id_fkey(abbreviation), home_team:teams!games_home_team_id_fkey(abbreviation)").eq("season", season).eq("season_type", "REG").order("kickoff_at"),
    admin.from("sync_runs").select("status, finished_at").eq("season", season).order("started_at", { ascending: false }).limit(20),
  ]);
  if (gamesError) throw gamesError;
  if (runsError) throw runsError;
  const gameRows = (games ?? []) as unknown as AlertGame[];
  const runRows = (runs ?? []) as OperationsSyncRun[];
  return { gameRows, health: gameDayHealth(gameRows, runRows, now) };
}

function matchup(game: AlertGame) {
  return `Week ${game.week}: ${game.away_team.abbreviation} at ${game.home_team.abbreviation}`;
}

export async function checkStaleSyncAlert(admin: AdminClient, season: number, now = new Date()) {
  const { gameRows, health } = await loadHealth(admin, season, now);
  if (!health.monitoredGameIds.length || health.syncFresh || !health.latestSuccessfulSyncAt) return null;
  const monitored = gameRows.filter((game) => health.monitoredGameIds.includes(game.id));
  return sendAlert(admin, {
    type: "stale_sync",
    season,
    subjects: health.monitoredGameIds,
    title: "Score data is stale",
    summary: "Active-game data has not completed a successful sync in more than 30 minutes.",
    details: monitored.map(matchup),
    now,
  });
}

export async function checkResultAttentionAlert(admin: AdminClient, season: number, now = new Date()) {
  const { gameRows, health } = await loadHealth(admin, season, now);
  if (!health.attentionGameIds.length) return null;
  const attention = gameRows.filter((game) => health.attentionGameIds.includes(game.id));
  return sendAlert(admin, {
    type: "result_attention",
    season,
    subjects: health.attentionGameIds,
    title: "Game results need attention",
    summary: "One or more games are overdue or marked final without complete scores and a winner.",
    details: attention.map((game) => `${matchup(game)} · ${game.status}`),
    now,
  });
}

export async function sendSyncFailureAlert(admin: AdminClient, season: number, weeks: number[], error: unknown, now = new Date()) {
  const message = error instanceof Error ? error.message : "Unknown score-sync error";
  return sendAlert(admin, {
    type: "sync_error",
    season,
    subjects: weeks.map((week) => `week-${week}`),
    title: "Score sync failed",
    summary: `The automatic score sync failed for ${weeks.map((week) => `Week ${week}`).join(", ")}.`,
    details: [message],
    now,
  });
}
