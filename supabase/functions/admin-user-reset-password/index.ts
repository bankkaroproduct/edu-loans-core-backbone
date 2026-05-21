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

  // Only confirm the email if it isn't already confirmed — avoids unnecessary
  // auth mutations on already-active users.
  const { data: authLookup } = await service.auth.admin.getUserById(target.auth_user_id as string);
  const alreadyConfirmed = !!authLookup?.user?.email_confirmed_at;

  const { error } = await service.auth.admin.updateUserById(target.auth_user_id as string, {
    password: newPassword,
    ...(alreadyConfirmed ? {} : { email_confirm: true }),
  });
  if (error) {
    // Surface the real upstream message + status so the client toast is useful
    // and future failures are visible in edge function logs.
    console.error("admin-user-reset-password updateUserById failed", {
      target_user_id: body.user_id,
      auth_user_id: target.auth_user_id,
      error_name: (error as { name?: string }).name,
      error_status: (error as { status?: number }).status,
      error_message: error.message,
    });
    const status = (error as { status?: number }).status ?? 400;
    return jsonResponse({ error: error.message, code: (error as { name?: string }).name ?? "auth_update_failed" }, status);
  }

  await writeAudit(service, {
    entityId: body.user_id,
    actionType: "admin_user_password_changed_by_admin",
    actorUserId: actor.appUserId,
    actorRole: actor.appUserRole,
    meta: { email: target.email, method: "direct_password_update" },
  });

  return jsonResponse({ ok: true });
});
