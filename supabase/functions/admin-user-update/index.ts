// Update an admin user's profile, section permissions and partner assignments.
import { corsHeaders, jsonResponse, requireSuperAdmin, writeAudit } from "../_shared/adminAuth.ts";

type SectionLevel = { section: string; access_level: "hidden" | "view" | "full" };
type Body = {
  user_id: string;
  full_name?: string;
  allow_admin_mode?: boolean;
  partner_ids?: string[];
  permissions?: SectionLevel[];
};

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
    .select("id, is_super_admin, full_name, allow_admin_mode")
    .eq("id", body.user_id)
    .maybeSingle();
  if (!target) return jsonResponse({ error: "user not found" }, 404);
  if (target.is_super_admin) {
    return jsonResponse({ error: "cannot modify super admin permissions" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.full_name === "string" && body.full_name.trim()) updates.full_name = body.full_name.trim();
  if (typeof body.allow_admin_mode === "boolean") updates.allow_admin_mode = body.allow_admin_mode;
  if (Object.keys(updates).length) {
    await service.from("users").update(updates).eq("id", body.user_id);
  }

  if (Array.isArray(body.permissions)) {
    await service.from("admin_section_permissions").delete().eq("user_id", body.user_id);
    const rows = body.permissions
      .filter((p) => p && p.section && p.access_level)
      .map((p) => ({ user_id: body.user_id, section: p.section, access_level: p.access_level }));
    if (rows.length) await service.from("admin_section_permissions").insert(rows);
  }

  if (Array.isArray(body.partner_ids)) {
    await service.from("admin_partner_assignments").delete().eq("user_id", body.user_id);
    const rows = body.partner_ids.filter(Boolean).map((pid) => ({ user_id: body.user_id, partner_id: pid }));
    if (rows.length) await service.from("admin_partner_assignments").insert(rows);
  }

  await writeAudit(service, {
    entityId: body.user_id,
    actionType: "admin_user_updated",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
    oldValue: { full_name: target.full_name, allow_admin_mode: target.allow_admin_mode },
    newValue: updates,
    meta: {
      permissions_count: body.permissions?.length,
      partner_count: body.partner_ids?.length,
    },
  });

  return jsonResponse({ ok: true });
});
