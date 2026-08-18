import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyReminderUnsubscribeToken } from "@/lib/reminderUnsubscribe";

export const dynamic = "force-dynamic";

function page(title: string, message: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Pretzel Quest</title><body style="margin:0;background:#050505;color:#f9fafb;font-family:Arial,sans-serif"><main style="max-width:560px;margin:0 auto;padding:64px 24px"><div style="color:#f59e0b;font-weight:700">🥨 PRETZEL QUEST</div><h1 style="font-size:30px;margin:24px 0 12px">${title}</h1><p style="color:#d1d5db;line-height:1.6">${message}</p><a href="https://pretzel.quest/profile" style="display:inline-block;margin-top:18px;color:#93c5fd">Manage reminder settings</a></main></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function unsubscribe(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = new URL(request.url).searchParams.get("token");
  if (!secret || !token) return { ok: false as const, status: 400 };
  const userId = verifyReminderUnsubscribeToken(token, secret);
  if (!userId) return { ok: false as const, status: 400 };

  const { error } = await createSupabaseAdmin()
    .from("pick_reminder_preferences")
    .update({ thursday_enabled: false, sunday_enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
  return { ok: true as const, status: 200 };
}

export async function GET(request: Request) {
  try {
    const result = await unsubscribe(request);
    return result.ok
      ? page("You’re unsubscribed", "Thursday and Sunday pick reminders are now off. You can turn either reminder back on from your profile anytime.")
      : page("This link isn’t valid", "No reminder settings were changed. Open your profile to manage reminders.", result.status);
  } catch (error) {
    console.error("Reminder unsubscribe failed", error);
    return page("Something went wrong", "Your reminder settings could not be changed. Please try again from your profile.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const result = await unsubscribe(request);
    return new Response(null, { status: result.status, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("One-click reminder unsubscribe failed", error);
    return new Response(null, { status: 500 });
  }
}
