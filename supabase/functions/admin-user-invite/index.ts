// Invite a new admin user. Creates auth user via Supabase invite, then a
// public.users row, section permissions, and partner assignments.
import { corsHeaders, jsonResponse, requireSuperAdmin, writeAudit } from "../_shared/adminAuth.ts";

type SectionLevel = { section: string; access_level: "hidden" | "view" | "full" };
type Body = {
  email: string;
  full_name: string;
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

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();
  if (!email || !/^.+@.+\..+$/.test(email)) return jsonResponse({ error: "invalid email" }, 400);
  if (!fullName) return jsonResponse({ error: "full_name required" }, 400);

  // Check for existing app user
  const { data: existing } = await service.from("users").select("id").ilike("email", email).maybeSingle();
  if (existing) return jsonResponse({ error: "user with this email already exists" }, 409);

  const origin = req.headers.get("origin") ?? "";
  const redirectTo = origin ? `${origin}/admin/login` : undefined;

  // Invite via Supabase Auth (sends email; user sets own password).
  const { data: invited, error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (inviteErr || !invited?.user) {
    return jsonResponse({ error: inviteErr?.message ?? "invite failed" }, 400);
  }

  // Insert / update app user row (handle_new_auth_user trigger may have inserted
  // a default partner_agent row — upgrade it to admin).
  const { data: existingByAuth } = await service
    .from("users")
    .select("id")
    .eq("auth_user_id", invited.user.id)
    .maybeSingle();

  let appUserId: string;
  if (existingByAuth) {
    appUserId = existingByAuth.id;
    await service
      .from("users")
      .update({
        full_name: fullName,
        email,
        role: "admin",
        is_super_admin: false,
        is_active: true,
        terminated_at: null,
        allow_admin_mode: body.allow_admin_mode ?? true,
      })
      .eq("id", appUserId);
  } else {
    const { data: inserted, error: insErr } = await service
      .from("users")
      .insert({
        auth_user_id: invited.user.id,
        email,
        full_name: fullName,
        role: "admin",
        is_super_admin: false,
        is_active: true,
        allow_admin_mode: body.allow_admin_mode ?? true,
      })
      .select("id")
      .single();
    if (insErr || !inserted) return jsonResponse({ error: insErr?.message ?? "user insert failed" }, 500);
    appUserId = inserted.id;
  }

  // Replace permissions
  if (Array.isArray(body.permissions)) {
    await service.from("admin_section_permissions").delete().eq("user_id", appUserId);
    const rows = body.permissions
      .filter((p) => p && p.section && p.access_level)
      .map((p) => ({ user_id: appUserId, section: p.section, access_level: p.access_level }));
    if (rows.length) await service.from("admin_section_permissions").insert(rows);
  }

  // Replace partner assignments
  if (Array.isArray(body.partner_ids)) {
    await service.from("admin_partner_assignments").delete().eq("user_id", appUserId);
    const rows = body.partner_ids.filter(Boolean).map((pid) => ({ user_id: appUserId, partner_id: pid }));
    if (rows.length) await service.from("admin_partner_assignments").insert(rows);
  }

  await writeAudit(service, {
    entityId: appUserId,
    actionType: "admin_user_invited",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
    newValue: { email, full_name: fullName, allow_admin_mode: body.allow_admin_mode ?? true },
    meta: {
      permissions_count: body.permissions?.length ?? 0,
      partner_count: body.partner_ids?.length ?? 0,
    },
  });

  return jsonResponse({ ok: true, user_id: appUserId, auth_user_id: invited.user.id });
});
