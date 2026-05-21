// Reset an admin user's password directly (no email sent).
// Super admin sets a new password; user can sign in with it immediately.
import { corsHeaders, jsonResponse, requireSuperAdmin, writeAudit } from "../_shared/adminAuth.ts";

type Body = { user_id: string; new_password: string };

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

  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  if (newPassword.length < 8) {
    return jsonResponse({ error: "new_password must be at least 8 characters" }, 400);
  }

  const { data: target } = await service
    .from("users")
    .select("id, email, auth_user_id")
    .eq("id", body.user_id)
    .maybeSingle();
  if (!target?.auth_user_id) return jsonResponse({ error: "user not found or not linked to an auth account" }, 404);

  const { error } = await service.auth.admin.updateUserById(target.auth_user_id, {
    password: newPassword,
    email_confirm: true,
  });
  if (error) return jsonResponse({ error: error.message }, 400);

  await writeAudit(service, {
    entityId: body.user_id,
    actionType: "admin_user_password_changed_by_admin",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
    meta: { email: target.email, method: "direct_password_update" },
  });

  return jsonResponse({ ok: true });
});
