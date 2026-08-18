import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getResend, pickReminderHtml } from "@/lib/resend";
import { localDateKey, localDay, reminderKindForDay, utcForLocal } from "@/lib/reminderSchedule";
import { reminderUnsubscribeUrl } from "@/lib/reminderUnsubscribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SEASON = 2026;
type Preference = { user_id: string; thursday_enabled: boolean; sunday_enabled: boolean; timezone: string; local_hour: number };
type Game = { id: string; week: number; kickoff_at: string; away_team: { name: string }; home_team: { name: string } };
type Pick = { user_id: string; game_id: string };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !fromEmail) return Response.json({ ok: false, configured: false, message: "Resend is not configured." }, { status: 503 });
  try {
    const admin = createSupabaseAdmin(); const now = new Date();
    const [preferenceResult, gameResult, userResult] = await Promise.all([
      admin.from("pick_reminder_preferences").select("user_id, thursday_enabled, sunday_enabled, timezone, local_hour").or("thursday_enabled.eq.true,sunday_enabled.eq.true"),
      admin.from("games").select("id, week, kickoff_at, away_team:teams!games_away_team_id_fkey(name), home_team:teams!games_home_team_id_fkey(name)").eq("season", SEASON).eq("season_type", "REG").gte("kickoff_at", now.toISOString()).order("kickoff_at"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (preferenceResult.error) throw preferenceResult.error; if (gameResult.error) throw gameResult.error; if (userResult.error) throw userResult.error;
    const preferences = (preferenceResult.data ?? []) as Preference[]; const games = (gameResult.data ?? []) as unknown as Game[];
    const userIds = preferences.map((preference) => preference.user_id);
    const [pickResult, deliveryResult, profileResult] = userIds.length ? await Promise.all([
      admin.from("picks").select("user_id, game_id").in("user_id", userIds),
      admin.from("pick_reminder_deliveries").select("id, user_id, week, reminder_kind, status").eq("season", SEASON).in("user_id", userIds),
      admin.from("profiles").select("user_id, display_name").in("user_id", userIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    if (pickResult.error) throw pickResult.error; if (deliveryResult.error) throw deliveryResult.error; if (profileResult.error) throw profileResult.error;
    const picked = new Set(((pickResult.data ?? []) as Pick[]).map((pick) => `${pick.user_id}:${pick.game_id}`));
    const deliveries = new Map((deliveryResult.data ?? []).map((item) => [`${item.user_id}:${item.week}:${item.reminder_kind}`, item]));
    const names = new Map((profileResult.data ?? []).map((profile) => [profile.user_id, profile.display_name]));
    const emailByUser = new Map(userResult.data.users.map((user) => [user.id, { email: user.email, name: names.get(user.id) || user.email?.split("@")[0] }]));
    const resend = getResend(); let scheduled = 0; let skipped = 0; const failures: string[] = [];
    for (const preference of preferences) {
      let day; try { day = localDay(now, preference.timezone); } catch { failures.push(`${preference.user_id}: invalid timezone`); continue; }
      const kind = reminderKindForDay(day); if (!kind || (kind === "thursday" && !preference.thursday_enabled) || (kind === "sunday" && !preference.sunday_enabled)) { skipped += 1; continue; }
      const today = `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      const tomorrow = new Date(Date.UTC(day.year, day.month - 1, day.day + 1)).toISOString().slice(0, 10);
      const relevant = games.filter((game) => { const key = localDateKey(new Date(game.kickoff_at), preference.timezone); return kind === "thursday" ? key === today : key === today || key === tomorrow; });
      const week = relevant[0]?.week; if (!week) { skipped += 1; continue; }
      const remaining = relevant.filter((game) => game.week === week && !picked.has(`${preference.user_id}:${game.id}`));
      const deliveryKey = `${preference.user_id}:${week}:${kind}`; const previousDelivery = deliveries.get(deliveryKey);
      if (!remaining.length || (previousDelivery && previousDelivery.status !== "failed")) { skipped += 1; continue; }
      const recipient = emailByUser.get(preference.user_id); if (!recipient?.email) { failures.push(`${preference.user_id}: email unavailable`); continue; }
      const scheduledFor = utcForLocal(day, preference.local_hour, preference.timezone); const deliveryTime = scheduledFor.getTime() > now.getTime() + 120_000 ? scheduledFor.toISOString() : undefined;
      const deliveryRequest = previousDelivery ? admin.from("pick_reminder_deliveries").update({ scheduled_for: scheduledFor.toISOString(), status: "scheduling", error: null }).eq("id", previousDelivery.id).select("id").single() : admin.from("pick_reminder_deliveries").insert({ user_id: preference.user_id, season: SEASON, week, reminder_kind: kind, scheduled_for: scheduledFor.toISOString(), status: "scheduling" }).select("id").single();
      const { data: delivery, error: insertError } = await deliveryRequest; if (insertError) { if (insertError.code === "23505") { skipped += 1; continue; } throw insertError; }
      const unsubscribeUrl = reminderUnsubscribeUrl(preference.user_id, secret);
      const result = await resend.emails.send({ from: `Pretzel Quest <${fromEmail}>`, to: recipient.email, subject: `${remaining.length} Week ${week} ${remaining.length === 1 ? "pick is" : "picks are"} still open`, html: pickReminderHtml({ name: recipient.name || "there", week, count: remaining.length, kind, matchups: remaining.map((game) => `${game.away_team.name} at ${game.home_team.name}`), unsubscribeUrl }), headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, ...(deliveryTime ? { scheduledAt: deliveryTime } : {}) });
      if (result.error) { await admin.from("pick_reminder_deliveries").update({ status: "failed", error: result.error.message }).eq("id", delivery.id); failures.push(`${preference.user_id}: ${result.error.message}`); continue; }
      await admin.from("pick_reminder_deliveries").update({ status: "scheduled", resend_email_id: result.data?.id ?? null }).eq("id", delivery.id); scheduled += 1;
    }
    return Response.json({ ok: failures.length === 0, configured: true, scheduled, skipped, failures: failures.length });
  } catch (error) { console.error("Pick reminder scheduling failed", error); return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unknown reminder error" }, { status: 500 }); }
}
