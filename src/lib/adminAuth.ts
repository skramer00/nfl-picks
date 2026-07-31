import { createSupabaseAdmin } from "./supabaseAdmin";

export async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) throw new Error("UNAUTHORIZED");

  const supabase = createSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("UNAUTHORIZED");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", userData.user.id)
    .single();

  if (profileError || !profile?.is_admin) throw new Error("FORBIDDEN");
  return { supabase, user: userData.user };
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  }
  console.error("Admin request failed", error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
