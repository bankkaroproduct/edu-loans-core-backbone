// Soft-terminate an admin user: is_active=false, terminated_at=now, revoke auth sessions.
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
  if (body.user_id === actor.appUserId) return jsonResponse({ error: "cannot terminate yourself" }, 400);

  const { data: target } = await service
    .from("users")
    .select("id, auth_user_id, is_super_admin, is_active")
    .eq("id", body.user_id)
    .maybeSingle();
  if (!target) return jsonResponse({ error: "user not found" }, 404);
  if (target.is_super_admin) return jsonResponse({ error: "cannot terminate a super admin" }, 400);

  await service
    .from("users")
    .update({ is_active: false, terminated_at: new Date().toISOString() })
    .eq("id", body.user_id);

  if (target.auth_user_id) {
    // best-effort sign out (admin API)
    try { await service.auth.admin.signOut(target.auth_user_id, "global"); } catch (_) { /* noop */ }
  }

  await writeAudit(service, {
    entityId: body.user_id,
    actionType: "admin_user_terminated",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
  });

  return jsonResponse({ ok: true });
});
