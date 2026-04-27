// Premiere College Lists — admin-only management endpoint.
//
// Actions (single function, dispatched on body.action):
//   - list:    summary table for the admin index page
//   - upload:  validates + commits a new list version (replace = same path,
//              old version is soft-archived via is_current=false)
//   - delete:  soft-archives the current version
//   - view:    paginated rows of a lender's current list (search, expired count)
//   - audit:   audit log for a lender (or all lenders)
//
// Hard rules enforced server-side regardless of client validation:
//   - Admin role required (else 403)
//   - File ≤ 5 MB, ≤ 10 000 rows
//   - Required columns: College Name, Country
//   - >20% parse failure → reject whole upload
//   - 0 valid rows → reject
//   - Daily cap: 10 uploads per lender per 24h
//   - Country must resolve via country_aliases or be left as-is (we still
//     accept it but flag rows where canonical resolution failed as skipped)
//
// Premiere data is competitive intel — every error path keeps responses
// admin-only; no public surface area.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set(["the", "a", "an", "of", "and"]);

function normalizeCollegeName(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input).toLowerCase();
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.split(" ").filter((t) => t.length > 0 && !STOPWORDS.has(t)).join(" ");
}

interface Row {
  college_name_raw: string;
  country_raw: string;
  city: string | null;
  notes: string | null;
  effective_from: string | null;
  effective_to: string | null;
}

const RowSchema = z.object({
  college_name_raw: z.string(),
  country_raw: z.string(),
  city: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  effective_from: z.string().nullable().optional(),
  effective_to: z.string().nullable().optional(),
});

const UploadSchema = z.object({
  action: z.literal("upload"),
  lender_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  file_size_bytes: z.number().int().positive().max(5 * 1024 * 1024),
  rows: z.array(RowSchema).max(10000),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  lender_id: z.string().uuid(),
});

const ListSchema = z.object({ action: z.literal("list") });

const ViewSchema = z.object({
  action: z.literal("view"),
  lender_id: z.string().uuid(),
  search: z.string().max(255).optional().default(""),
  page: z.number().int().min(0).default(0),
  page_size: z.number().int().min(1).max(200).default(50),
});

const AuditSchema = z.object({
  action: z.literal("audit"),
  lender_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

const BodySchema = z.discriminatedUnion("action", [
  UploadSchema,
  DeleteSchema,
  ListSchema,
  ViewSchema,
  AuditSchema,
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supaAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supaAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const authUserId = claimsData.claims.sub as string;

    const { data: userRow, error: userErr } = await supaAuth
      .from("users")
      .select("id, role")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (userErr) return json({ error: userErr.message }, 500);
    if (!userRow || (userRow.role !== "admin" && userRow.role !== "super_admin")) {
      return json({ error: "Forbidden — admin role required" }, 403);
    }
    const actorUserId = userRow.id as string;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        400,
      );
    }
    const body = parsed.data;

    const supaAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (body.action === "list") return await handleList(supaAdmin);
    if (body.action === "view") return await handleView(supaAdmin, body);
    if (body.action === "audit") return await handleAudit(supaAdmin, body);
    if (body.action === "delete") {
      return await handleDelete(supaAdmin, body, actorUserId);
    }
    if (body.action === "upload") {
      return await handleUpload(supaAdmin, body, actorUserId);
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[premiere-list-admin] unhandled error", msg);
    return json({ error: msg }, 500);
  }
});

async function handleList(supa: ReturnType<typeof createClient>) {
  const { data: lenders, error: lendersErr } = await supa
    .from("lenders")
    .select("id, lender_name, lender_code, active_flag")
    .eq("active_flag", true)
    .order("lender_name", { ascending: true });
  if (lendersErr) return json({ error: lendersErr.message }, 500);

  const lenderIds = (lenders ?? []).map((l) => l.id);
  if (lenderIds.length === 0) return json({ rows: [] }, 200);

  const { data: currentRows, error: rowsErr } = await supa
    .from("lender_premiere_colleges")
    .select("lender_id, list_version, uploaded_at, uploaded_by, source_file_name")
    .in("lender_id", lenderIds)
    .eq("is_current", true);
  if (rowsErr) return json({ error: rowsErr.message }, 500);

  const stats = new Map<
    string,
    { count: number; latest: string | null; uploadedBy: string | null; version: number | null; fileName: string | null }
  >();
  for (const r of currentRows ?? []) {
    const s = stats.get(r.lender_id) ?? {
      count: 0,
      latest: null,
      uploadedBy: null,
      version: null,
      fileName: null,
    };
    s.count += 1;
    if (!s.latest || (r.uploaded_at && r.uploaded_at > s.latest)) {
      s.latest = r.uploaded_at;
      s.uploadedBy = r.uploaded_by;
      s.version = r.list_version;
      s.fileName = r.source_file_name;
    }
    stats.set(r.lender_id, s);
  }

  const uploaderIds = Array.from(
    new Set(Array.from(stats.values()).map((s) => s.uploadedBy).filter(Boolean) as string[]),
  );
  let uploaderNames: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: us } = await supa
      .from("users")
      .select("id, full_name, email")
      .in("id", uploaderIds);
    uploaderNames = Object.fromEntries(
      (us ?? []).map((u) => [u.id as string, (u.full_name as string) || (u.email as string)]),
    );
  }

  const rows = (lenders ?? []).map((l) => {
    const s = stats.get(l.id);
    return {
      lender_id: l.id,
      lender_name: l.lender_name,
      lender_code: l.lender_code,
      list_status: s ? "Uploaded" : "Not Uploaded",
      row_count: s?.count ?? 0,
      list_version: s?.version ?? null,
      last_updated_at: s?.latest ?? null,
      last_updated_by: s?.uploadedBy ? uploaderNames[s.uploadedBy] ?? null : null,
      source_file_name: s?.fileName ?? null,
    };
  });
  return json({ rows }, 200);
}

async function handleView(
  supa: ReturnType<typeof createClient>,
  body: z.infer<typeof ViewSchema>,
) {
  const today = new Date().toISOString().slice(0, 10);

  let q = supa
    .from("lender_premiere_colleges")
    .select(
      "id, college_name_raw, college_name_normalized, country_raw, country_normalized, city, notes, effective_from, effective_to, list_version, uploaded_at, source_file_name",
      { count: "exact" },
    )
    .eq("lender_id", body.lender_id)
    .eq("is_current", true);

  if (body.search?.trim()) {
    const s = body.search.trim();
    q = q.or(
      `college_name_raw.ilike.%${s}%,college_name_normalized.ilike.%${s}%,country_raw.ilike.%${s}%,country_normalized.ilike.%${s}%`,
    );
  }
  q = q.order("college_name_normalized", { ascending: true })
    .range(body.page * body.page_size, body.page * body.page_size + body.page_size - 1);

  const { data, count, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const { count: expiredCount } = await supa
    .from("lender_premiere_colleges")
    .select("id", { count: "exact", head: true })
    .eq("lender_id", body.lender_id)
    .eq("is_current", true)
    .lt("effective_to", today);

  return json(
    {
      rows: data ?? [],
      total: count ?? 0,
      expired_count: expiredCount ?? 0,
      page: body.page,
      page_size: body.page_size,
    },
    200,
  );
}

async function handleAudit(
  supa: ReturnType<typeof createClient>,
  body: z.infer<typeof AuditSchema>,
) {
  let q = supa
    .from("lender_premiere_audit")
    .select(
      "id, lender_id, action, file_name, row_count, list_version, actor_user_id, meta, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(body.limit);
  if (body.lender_id) q = q.eq("lender_id", body.lender_id);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const actorIds = Array.from(
    new Set(((data ?? []).map((r) => r.actor_user_id).filter(Boolean)) as string[]),
  );
  let actors: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: us } = await supa
      .from("users").select("id, full_name, email").in("id", actorIds);
    actors = Object.fromEntries(
      (us ?? []).map((u) => [u.id as string, (u.full_name as string) || (u.email as string)]),
    );
  }

  return json({
    rows: (data ?? []).map((r) => ({
      ...r,
      actor_name: r.actor_user_id ? actors[r.actor_user_id as string] ?? null : null,
    })),
  }, 200);
}

async function handleDelete(
  supa: ReturnType<typeof createClient>,
  body: z.infer<typeof DeleteSchema>,
  actorUserId: string,
) {
  const ok = await checkDailyCap(supa, body.lender_id);
  if (!ok) {
    return json(
      { error: "Daily limit reached: max 10 upload/replace/delete operations per lender per 24h." },
      429,
    );
  }

  const { count } = await supa
    .from("lender_premiere_colleges")
    .select("id", { count: "exact", head: true })
    .eq("lender_id", body.lender_id)
    .eq("is_current", true);

  if (!count) {
    return json({ error: "No current premiere list to delete for this lender." }, 400);
  }

  const { error: updErr } = await supa
    .from("lender_premiere_colleges")
    .update({ is_current: false })
    .eq("lender_id", body.lender_id)
    .eq("is_current", true);
  if (updErr) return json({ error: updErr.message }, 500);

  await supa.from("lender_premiere_audit").insert({
    lender_id: body.lender_id,
    action: "delete",
    actor_user_id: actorUserId,
    row_count: count ?? 0,
  });

  return json({ ok: true, archived_rows: count ?? 0 }, 200);
}

async function handleUpload(
  supa: ReturnType<typeof createClient>,
  body: z.infer<typeof UploadSchema>,
  actorUserId: string,
) {
  const { data: lender, error: lendErr } = await supa
    .from("lenders")
    .select("id, active_flag")
    .eq("id", body.lender_id)
    .maybeSingle();
  if (lendErr) return json({ error: lendErr.message }, 500);
  if (!lender || !lender.active_flag) {
    return json({ error: "Lender not found or inactive." }, 400);
  }

  const ok = await checkDailyCap(supa, body.lender_id);
  if (!ok) {
    return json(
      { error: "Daily limit reached: max 10 operations per lender per 24h." },
      429,
    );
  }

  const { data: aliases, error: aliasErr } = await supa
    .from("country_aliases")
    .select("alias_lower, canonical_name");
  if (aliasErr) return json({ error: aliasErr.message }, 500);
  const aliasMap = new Map(
    (aliases ?? []).map((a) => [a.alias_lower as string, a.canonical_name as string]),
  );

  const valid: Array<{
    college_name_raw: string;
    college_name_normalized: string;
    country_raw: string;
    country_normalized: string;
    city: string | null;
    notes: string | null;
    effective_from: string | null;
    effective_to: string | null;
  }> = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  let parseFailures = 0;
  const seenComposite = new Set<string>();

  body.rows.forEach((r, i) => {
    const college = (r.college_name_raw ?? "").trim();
    const country = (r.country_raw ?? "").trim();
    const rowNum = i + 2;

    if (!college || !country) {
      parseFailures++;
      skipped.push({ row: rowNum, reason: "Missing College Name or Country" });
      return;
    }
    if (college.startsWith("(")) {
      skipped.push({ row: rowNum, reason: "College Name starts with '(' — skipped per rule" });
      return;
    }
    const collegeNorm = normalizeCollegeName(college);
    if (!collegeNorm) {
      skipped.push({ row: rowNum, reason: "College Name normalises to empty" });
      return;
    }
    const lookup = country.toLowerCase();
    const canonical = aliasMap.get(lookup);
    if (!canonical) {
      skipped.push({ row: rowNum, reason: `Unrecognised country: "${country}"` });
      return;
    }
    const ef = (r.effective_from ?? "").trim() || null;
    const et = (r.effective_to ?? "").trim() || null;
    if (ef && et && ef > et) {
      skipped.push({ row: rowNum, reason: "Effective From > Effective To" });
      return;
    }
    const composite = `${collegeNorm}::${canonical}`;
    if (seenComposite.has(composite)) {
      skipped.push({ row: rowNum, reason: "Duplicate (college, country) within file — keeping first" });
      return;
    }
    seenComposite.add(composite);
    valid.push({
      college_name_raw: college,
      college_name_normalized: collegeNorm,
      country_raw: country,
      country_normalized: canonical,
      city: r.city?.trim() || null,
      notes: r.notes?.trim() || null,
      effective_from: ef,
      effective_to: et,
    });
  });

  if (body.rows.length === 0) {
    return json({ error: "File contains 0 rows." }, 400);
  }
  if (parseFailures / body.rows.length > 0.2) {
    return json(
      {
        error: `Upload rejected: ${parseFailures} of ${body.rows.length} rows failed required-column parsing (>20%).`,
        skipped,
      },
      400,
    );
  }
  if (valid.length === 0) {
    return json({ error: "Upload rejected: 0 valid rows after filtering.", skipped }, 400);
  }

  const { data: maxRow, error: maxErr } = await supa
    .from("lender_premiere_colleges")
    .select("list_version")
    .eq("lender_id", body.lender_id)
    .order("list_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) return json({ error: maxErr.message }, 500);
  const nextVersion = (maxRow?.list_version ?? 0) + 1;
  const wasReplace = (maxRow?.list_version ?? 0) > 0;

  const { error: archErr } = await supa
    .from("lender_premiere_colleges")
    .update({ is_current: false })
    .eq("lender_id", body.lender_id)
    .eq("is_current", true);
  if (archErr) return json({ error: archErr.message }, 500);

  const inserted: number[] = [];
  const insertRows = valid.map((v) => ({
    ...v,
    lender_id: body.lender_id,
    list_version: nextVersion,
    is_current: true,
    uploaded_by: actorUserId,
    source_file_name: body.file_name,
  }));
  for (let i = 0; i < insertRows.length; i += 500) {
    const chunk = insertRows.slice(i, i + 500);
    const { error: insErr, count } = await supa
      .from("lender_premiere_colleges")
      .insert(chunk, { count: "exact" });
    if (insErr) {
      return json(
        {
          error: `Insert failed at chunk ${i}: ${insErr.message}`,
          inserted_so_far: inserted.reduce((a, b) => a + b, 0),
        },
        500,
      );
    }
    inserted.push(count ?? chunk.length);
  }

  await supa.from("lender_premiere_audit").insert({
    lender_id: body.lender_id,
    action: wasReplace ? "replace" : "upload",
    actor_user_id: actorUserId,
    file_name: body.file_name,
    row_count: valid.length,
    list_version: nextVersion,
    meta: {
      file_size_bytes: body.file_size_bytes,
      total_rows_in_file: body.rows.length,
      skipped_count: skipped.length,
    },
  });

  return json(
    {
      ok: true,
      action: wasReplace ? "replace" : "upload",
      list_version: nextVersion,
      inserted_rows: valid.length,
      skipped_rows: skipped.length,
      skipped_sample: skipped.slice(0, 50),
    },
    200,
  );
}

async function checkDailyCap(
  supa: ReturnType<typeof createClient>,
  lenderId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supa
    .from("lender_premiere_audit")
    .select("id", { count: "exact", head: true })
    .eq("lender_id", lenderId)
    .gte("created_at", since);
  return (count ?? 0) < 10;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
