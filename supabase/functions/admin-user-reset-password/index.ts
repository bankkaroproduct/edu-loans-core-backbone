// Trigger a password reset email for an admin user.
import { corsHeaders, jsonResponse, requireSuperAdmin, writeAudit } from "../_shared/adminAuth.ts";

type Body = { user_id: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return gate.response;
  const { actor } = gate;
  const service = actor.serviceClient;

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid json" }, 400); }
  if (!body.user_id) return jsonResponse({ error: "user_id required" }, 400);

  const { data: target } = await service
    .from("users")
    .select("id, email")
    .eq("id", body.user_id)
    .maybeSingle();
  if (!target?.email) return jsonResponse({ error: "user not found" }, 404);

  const origin = req.headers.get("origin") ?? "";
  const redirectTo = origin ? `${origin}/admin/login` : undefined;

  const { error } = await service.auth.resetPasswordForEmail(target.email, { redirectTo });
  if (error) return jsonResponse({ error: error.message }, 400);

  await writeAudit(service, {
    entityId: body.user_id,
    actionType: "admin_user_password_reset_sent",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
    meta: { email: target.email },
  });

  return jsonResponse({ ok: true });
});
