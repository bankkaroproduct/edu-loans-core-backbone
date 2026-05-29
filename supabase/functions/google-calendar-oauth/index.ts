// Google Calendar OAuth: initiate + callback.
// /google-calendar-oauth/initiate  (POST, JWT required)  -> { authUrl }
// /google-calendar-oauth/callback  (GET, public — Google redirects here)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// TEMPORARY HARDCODE for testing — remove once Supabase secret is fixed
const HARDCODED_GOOGLE_CLIENT_ID = "187263863670-cfvlaboaiinetdngmnsqapskasa9nv8k.apps.googleusercontent.com";
const RAW_GOOGLE_CLIENT_ID = HARDCODED_GOOGLE_CLIENT_ID;
const RAW_GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const GOOGLE_CLIENT_ID = RAW_GOOGLE_CLIENT_ID.trim();
const GOOGLE_CLIENT_SECRET = RAW_GOOGLE_CLIENT_SECRET.trim();

// TEMP DIAGNOSTIC — remove after verification
console.log("[diag] client_id_prefix:", GOOGLE_CLIENT_ID.slice(0, 10));
console.log("[diag] client_id_len raw/trim:", RAW_GOOGLE_CLIENT_ID.length, GOOGLE_CLIENT_ID.length);
console.log("[diag] client_id_had_whitespace:", RAW_GOOGLE_CLIENT_ID !== GOOGLE_CLIENT_ID);
console.log("[diag] client_secret_len raw/trim:", RAW_GOOGLE_CLIENT_SECRET.length, GOOGLE_CLIENT_SECRET.length);
console.log("[diag] client_secret_had_whitespace:", RAW_GOOGLE_CLIENT_SECRET !== GOOGLE_CLIENT_SECRET);

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-oauth/callback`;
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- state signing (HMAC-SHA256 with service role secret) ----
async function hmacKey() {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64url(sig)}`;
}
async function verifyState(token: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey();
  const ok = await crypto.subtle.verify("HMAC", key, fromB64url(sig), new TextEncoder().encode(body));
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop() || "";

  try {
    // -------- INITIATE (auth required) --------
    if (path === "initiate" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) return json({ error: "unauthorized" }, 401);
      const authUserId = claimsData.claims.sub as string;

      const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: appUser } = await service
        .from("users")
        .select("id, role, is_active, terminated_at")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (
        !appUser ||
        !["admin", "super_admin"].includes((appUser as { role: string }).role) ||
        (appUser as { is_active: boolean }).is_active !== true ||
        (appUser as { terminated_at: unknown }).terminated_at !== null
      ) {
        return json({ error: "forbidden" }, 403);
      }

      const body = await req.json().catch(() => ({}));
      const returnTo = typeof body?.return_to === "string" ? body.return_to : "";

      const state = await signState({
        u: (appUser as { id: string }).id,
        r: returnTo,
        n: crypto.randomUUID(),
        t: Date.now(),
      });

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("state", state);

      return json({
        authUrl: authUrl.toString(),
        _diag: {
          client_id_prefix: GOOGLE_CLIENT_ID.slice(0, 10),
          client_id_len: GOOGLE_CLIENT_ID.length,
          had_whitespace: RAW_GOOGLE_CLIENT_ID !== GOOGLE_CLIENT_ID,
          secret_len: GOOGLE_CLIENT_SECRET.length,
          secret_had_whitespace: RAW_GOOGLE_CLIENT_SECRET !== GOOGLE_CLIENT_SECRET,
        },
      });
    }

    // -------- CALLBACK (Google redirects user-agent here) --------
    if (path === "callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      const errParam = url.searchParams.get("error");

      const errorRedirect = (msg: string, ret = "") => {
        const target = new URL(ret || "https://edu-loans-core-backbone.lovable.app/admin/calendar");
        target.searchParams.set("calendar_error", msg);
        return Response.redirect(target.toString(), 302);
      };

      if (errParam) return errorRedirect(errParam);
      if (!code || !stateRaw) return errorRedirect("missing_code_or_state");

      const state = await verifyState(stateRaw);
      if (!state || typeof state.u !== "string") return errorRedirect("invalid_state");
      const userId = state.u as string;
      const returnTo = (state.r as string) || "";

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.refresh_token) {
        console.error("Token exchange failed:", tokens);
        return errorRedirect(tokens.error || "token_exchange_failed", returnTo);
      }

      // Fetch userinfo
      const uiRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const ui = await uiRes.json();

      const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

      const { error: upErr } = await service.from("admin_google_tokens").upsert(
        {
          user_id: userId,
          google_email: ui.email ?? "",
          google_name: ui.name ?? null,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          token_expires_at: expiresAt,
          scope: tokens.scope ?? SCOPES,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (upErr) {
        console.error("Token upsert failed:", upErr);
        return errorRedirect("token_save_failed", returnTo);
      }

      const target = new URL(returnTo || "https://edu-loans-core-backbone.lovable.app/admin/calendar");
      target.searchParams.set("calendar_connected", "1");
      return Response.redirect(target.toString(), 302);
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("oauth error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
