// Shared helpers for Google Calendar edge functions.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type CalendarActor = {
  appUserId: string;
  role: string;
  isSuperAdmin: boolean;
  service: SupabaseClient;
};

export async function requireAdmin(req: Request):
  Promise<{ ok: true; actor: CalendarActor } | { ok: false; response: Response }>
{
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: json({ error: "unauthorized" }, 401) };
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return { ok: false, response: json({ error: "unauthorized" }, 401) };
  }
  const authUserId = claimsData.claims.sub as string;
  const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: appUser } = await service
    .from("users")
    .select("id, role, is_super_admin, is_active, terminated_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (
    !appUser ||
    !["admin", "super_admin"].includes((appUser as { role: string }).role) ||
    (appUser as { is_active: boolean }).is_active !== true ||
    (appUser as { terminated_at: unknown }).terminated_at !== null
  ) {
    return { ok: false, response: json({ error: "forbidden" }, 403) };
  }
  return {
    ok: true,
    actor: {
      appUserId: (appUser as { id: string }).id,
      role: (appUser as { role: string }).role,
      isSuperAdmin: (appUser as { is_super_admin: boolean }).is_super_admin === true,
      service,
    },
  };
}

/** Returns a valid access token for the given app user_id, refreshing if needed. */
export async function getAccessToken(service: SupabaseClient, userId: string): Promise<string> {
  const { data: row, error } = await service
    .from("admin_google_tokens")
    .select("refresh_token, access_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !row) throw new Error("not_connected");

  const expires = row.token_expires_at ? new Date(row.token_expires_at as string).getTime() : 0;
  // Refresh 60s before actual expiry
  if (row.access_token && expires - 60_000 > Date.now()) {
    return row.access_token as string;
  }

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: row.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  const tk = await refreshRes.json();
  if (!refreshRes.ok || !tk.access_token) {
    console.error("Refresh failed:", tk);
    throw new Error("refresh_failed");
  }
  const newExpiry = new Date(Date.now() + (tk.expires_in ?? 3600) * 1000).toISOString();
  await service
    .from("admin_google_tokens")
    .update({
      access_token: tk.access_token,
      token_expires_at: newExpiry,
      last_synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return tk.access_token as string;
}
