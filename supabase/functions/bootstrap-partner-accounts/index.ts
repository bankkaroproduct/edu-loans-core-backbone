// One-shot bootstrap: create 57 partner accounts (partner_agent role).
// - Admin/super_admin auth required.
// - Idempotent: existing partner_code rows are skipped (no recreation).
// - Temp passwords are returned in the response and NOT stored anywhere
//   (no audit_log of the password, no console log of the password).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PartnerRow {
  sr: number;
  name: string;
  city: string;
  contact_name: string;
  phone: string;
}

const SYNTHETIC_DOMAIN = "eduloanspartner.com";

function slugUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

function genPassword(): string {
  // 14 chars: a-z A-Z 0-9 plus a couple of symbols. No logging anywhere.
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const buf = new Uint8Array(14);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < buf.length; i++) out += charset[buf[i] % charset.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Auth: accept either an admin user JWT, or the service-role key
    //    (used for the one-time bootstrap). Both paths require explicit credentials.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    if (!bearer) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let profile: { id: string | null; role: string };

    // Accept the project's service role key as a bootstrap credential.
    // We probe it against admin.auth.admin (only valid service-role keys
    // can list users) so we don't depend on string-equality with env.
    let isServiceRole = false;
    if (bearer && bearer !== SERVICE_ROLE) {
      try {
        const probe = createClient(SUPABASE_URL, bearer);
        const { error: probeErr } = await probe.auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });
        if (!probeErr) isServiceRole = true;
      } catch (_) {
        /* not a service role */
      }
    }

    if (bearer === SERVICE_ROLE || isServiceRole) {
      profile = { id: null, role: "super_admin" };
    } else {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: p } = await admin
        .from("users")
        .select("id, role")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (!p || (p.role !== "admin" && p.role !== "super_admin")) {
        return new Response(JSON.stringify({ error: "forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profile = { id: p.id, role: p.role };
    }

    const body = await req.json().catch(() => ({}));
    const partners: PartnerRow[] = body.partners ?? [];
    if (!Array.isArray(partners) || partners.length === 0) {
      return new Response(JSON.stringify({ error: "partners array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-load existing usernames for collision avoidance
    const { data: existingUsernames } = await admin
      .from("users")
      .select("username")
      .not("username", "is", null);
    const usedUsernames = new Set<string>(
      (existingUsernames ?? [])
        .map((r) => (r.username ?? "").toLowerCase())
        .filter(Boolean),
    );

    const results: Array<Record<string, unknown>> = [];

    for (const p of partners) {
      const partnerCode = `PTR-${String(p.sr).padStart(4, "0")}`;
      const out: Record<string, unknown> = {
        sr_no: p.sr,
        agency_name: p.name,
        city: p.city,
        contact_name: p.contact_name,
        contact_number: p.phone,
        partner_code: partnerCode,
      };

      try {
        // Idempotency: if partner_code already exists, skip entirely.
        const { data: existingPartner } = await admin
          .from("partner_organizations")
          .select("id, display_name")
          .eq("partner_code", partnerCode)
          .maybeSingle();
        if (existingPartner) {
          out.status = "skipped_exists";
          out.notes = "partner_code already present; not recreated";
          results.push(out);
          continue;
        }

        // Case-insensitive duplicate display_name guard
        const { data: dupName } = await admin
          .from("partner_organizations")
          .select("partner_code")
          .ilike("display_name", p.name)
          .maybeSingle();
        if (dupName) {
          out.status = "skipped_duplicate_name";
          out.notes = `duplicate display_name with ${dupName.partner_code}`;
          results.push(out);
          continue;
        }

        // Username allocation
        let base = slugUsername(p.name) || `partner_${p.sr}`;
        let username = base;
        let attempt = 0;
        while (usedUsernames.has(username)) {
          attempt++;
          const citySlug = slugUsername(p.city);
          if (attempt === 1 && citySlug) username = `${base}_${citySlug}`;
          else username = `${base}_${p.sr}`;
          if (attempt > 5) {
            username = `${base}_${p.sr}_${attempt}`;
            break;
          }
        }
        usedUsernames.add(username);

        const syntheticEmail = `${username}@${SYNTHETIC_DOMAIN}`;
        const password = genPassword();

        // 1) Create partner_organizations
        const { data: org, error: orgErr } = await admin
          .from("partner_organizations")
          .insert({
            partner_code: partnerCode,
            legal_name: p.name,
            display_name: p.name,
            partner_type: "education_consultant",
            status: "active",
            contact_person_name: p.contact_name || null,
            contact_person_phone: p.phone || null,
          })
          .select("id")
          .single();
        if (orgErr || !org) throw new Error(`org insert: ${orgErr?.message}`);

        // 2) Create auth user (service-role admin API)
        const { data: created, error: authErr } =
          await admin.auth.admin.createUser({
            email: syntheticEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: p.name, partner_code: partnerCode },
          });
        if (authErr || !created.user) {
          // Rollback org
          await admin.from("partner_organizations").delete().eq("id", org.id);
          throw new Error(`auth create: ${authErr?.message}`);
        }

        // 3) Upsert public.users (the auth trigger may have already created
        //    a row for this auth_user_id; update it instead of duplicating).
        const { data: existingProfile } = await admin
          .from("users")
          .select("id")
          .eq("auth_user_id", created.user.id)
          .maybeSingle();

        let appUserId: string;
        if (existingProfile) {
          const { error: updErr } = await admin
            .from("users")
            .update({
              email: syntheticEmail,
              full_name: p.name,
              role: "partner_agent",
              partner_id: org.id,
              username,
              phone: p.phone || null,
              is_active: true,
            })
            .eq("id", existingProfile.id);
          if (updErr) throw new Error(`user update: ${updErr.message}`);
          appUserId = existingProfile.id;
        } else {
          const { data: ins, error: insErr } = await admin
            .from("users")
            .insert({
              auth_user_id: created.user.id,
              email: syntheticEmail,
              full_name: p.name,
              role: "partner_agent",
              partner_id: org.id,
              username,
              phone: p.phone || null,
              is_active: true,
            })
            .select("id")
            .single();
          if (insErr || !ins) throw new Error(`user insert: ${insErr?.message}`);
          appUserId = ins.id;
        }

        // 4) user_roles
        await admin
          .from("user_roles")
          .upsert({ user_id: appUserId, role: "partner_agent" });

        // Audit (NO password — only metadata).
        await admin.from("audit_logs").insert({
          entity_type: "partner_organization",
          entity_id: org.id,
          action_type: "partner_account_bootstrapped",
          actor_user_id: profile.id,
          actor_role: profile.role,
          meta: {
            partner_code: partnerCode,
            username,
            synthetic_email: syntheticEmail,
            sr_no: p.sr,
          },
        });

        out.status = "created";
        out.username = username;
        out.synthetic_email = syntheticEmail;
        out.temp_password = password; // returned ONLY to caller; not stored.
        results.push(out);
      } catch (e) {
        out.status = "error";
        out.notes = (e as Error).message;
        results.push(out);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        created: results.filter((r) => r.status === "created").length,
        skipped: results.filter((r) => String(r.status).startsWith("skipped"))
          .length,
        errors: results.filter((r) => r.status === "error").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
