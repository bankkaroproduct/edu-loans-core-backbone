// Shared auth utility for admin-user-* edge functions.
// Verifies the caller is an authenticated super admin and returns their app user row.
import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type ActorContext = {
  authUserId: string;
  appUserId: string;
  appUserRole: string;
  serviceClient: ReturnType<typeof createClient>;
};

export async function requireSuperAdmin(req: Request): Promise<
  | { ok: true; actor: ActorContext }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
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
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  const authUserId = claimsData.claims.sub as string;

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: appUser } = await serviceClient
    .from("users")
    .select("id, role, is_super_admin, is_active, terminated_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (
    !appUser ||
    appUser.is_super_admin !== true ||
    appUser.is_active !== true ||
    appUser.terminated_at !== null
  ) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "forbidden: super admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return {
    ok: true,
    actor: {
      authUserId,
      appUserId: appUser.id,
      appUserRole: appUser.role,
      serviceClient,
    },
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function writeAudit(
  service: ReturnType<typeof createClient>,
  args: {
    entityId: string;
    actionType: string;
    actorUserId: string;
    actorRole: string;
    oldValue?: unknown;
    newValue?: unknown;
    meta?: Record<string, unknown>;
  },
) {
  await service.from("audit_logs").insert({
    entity_type: "admin_user",
    entity_id: args.entityId,
    action_type: args.actionType,
    actor_user_id: args.actorUserId,
    actor_role: args.actorRole,
    old_value: args.oldValue ?? null,
    new_value: args.newValue ?? null,
    meta: args.meta ?? {},
  });
}
