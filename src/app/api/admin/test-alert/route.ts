import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import { sendTestAlert } from "@/lib/gameDayAlerts";

export const dynamic = "force-dynamic";

const SEASON = 2026;

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const result = await sendTestAlert(supabase, SEASON);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
