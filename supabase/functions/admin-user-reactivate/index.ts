// Reactivate a previously terminated admin user.
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
    .select("id")
    .eq("id", body.user_id)
    .maybeSingle();
  if (!target) return jsonResponse({ error: "user not found" }, 404);

  await service
    .from("users")
    .update({ is_active: true, terminated_at: null })
    .eq("id", body.user_id);

  await writeAudit(service, {
    entityId: body.user_id,
    actionType: "admin_user_reactivated",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
  });

  return jsonResponse({ ok: true });
});
