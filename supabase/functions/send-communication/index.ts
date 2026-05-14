import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const TWILIO_SANDBOX_FROM = "whatsapp:+14155238886";

interface AttachmentManifestEntry {
  document_id?: string;
  file_name?: string;
  storage_path?: string | null;
  document_name?: string | null;
}

interface SendInput {
  template_key: string;
  recipient: string;
  lead_id?: string | null;
  mode: "mock" | "demo_live";
  variables?: Record<string, string | number | null | undefined>;
  // --- Additive optional fields (used by the Admin "Send to Lender" flow) ---
  // All are backwards-compatible. If absent, the function behaves exactly
  // as before. None of these change lifecycle, partner, or BRE state.
  cc?: string[];
  subject_override?: string;
  body_override?: string;
  attachments_manifest?: AttachmentManifestEntry[];
  recipient_label?: string;
}

function renderTemplate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth + admin gate (verify caller is admin)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return new Response(JSON.stringify({ error: "invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: appUser } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (!appUser || (appUser.role !== "admin" && appUser.role !== "super_admin")) {
    return new Response(JSON.stringify({ error: "forbidden: admin role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: SendInput;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    template_key,
    recipient,
    lead_id,
    mode,
    variables = {},
    cc,
    subject_override,
    body_override,
    attachments_manifest,
    recipient_label,
  } = body;
  if (!template_key || !recipient || !mode) {
    return new Response(
      JSON.stringify({ error: "template_key, recipient, mode are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (mode !== "mock" && mode !== "demo_live") {
    return new Response(JSON.stringify({ error: "mode must be mock or demo_live" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load template
  const { data: tpl, error: tplErr } = await admin
    .from("communication_templates")
    .select("*")
    .eq("template_key", template_key)
    .eq("active_flag", true)
    .maybeSingle();

  if (tplErr || !tpl) {
    return new Response(JSON.stringify({ error: `template not found: ${template_key}` }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Allow caller to override subject/body (used by the Send-to-Lender compose
  // page where the admin has already reviewed/edited the draft). Falls back
  // to the template's own subject/body so existing callers are unaffected.
  const subjectSource = typeof subject_override === "string" && subject_override.length > 0
    ? subject_override
    : tpl.subject;
  const bodySource = typeof body_override === "string" && body_override.length > 0
    ? body_override
    : tpl.body;

  const renderedSubject = subjectSource ? renderTemplate(subjectSource, variables) : null;
  const renderedBody = renderTemplate(bodySource, variables);

  const sanitizedCc = Array.isArray(cc)
    ? cc.map((s) => String(s).trim()).filter((s) => s.length > 0)
    : [];

  const payloadSnapshot = {
    subject: renderedSubject,
    body: renderedBody,
    variables,
    template: { key: tpl.template_key, channel: tpl.channel },
    // Additive — preserved on the log for audit/debug. No behavior change.
    cc: sanitizedCc,
    attachments_manifest: attachments_manifest ?? [],
    recipient_label: recipient_label ?? null,
  };

  const baseLog = {
    channel: tpl.channel,
    template_key: tpl.template_key,
    recipient,
    lead_id: lead_id ?? null,
    payload_snapshot: payloadSnapshot,
    mode_used: mode,
    triggered_by_user: appUser.id,
  };

  // MOCK mode → simulate
  if (mode === "mock") {
    const { data: log } = await admin
      .from("communication_logs")
      .insert({ ...baseLog, provider: "mock", send_status: "simulated" })
      .select()
      .single();
    return new Response(
      JSON.stringify({ ok: true, mode: "mock", log_id: log?.id, preview: payloadSnapshot }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // DEMO_LIVE mode
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "EduLoans <loan@eduvouchers.com>";
  const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "loan@eduvouchers.com";

  if (tpl.channel === "email") {
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "resend",
          send_status: "failed",
          error_message: "Resend not configured — connect the Resend integration to enable live sends.",
        })
        .select()
        .single();
      return new Response(
        JSON.stringify({
          ok: false,
          error: "resend_not_configured",
          message: "Resend connector is not linked. Switch to mock mode or connect Resend.",
          log_id: log?.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Decide template-mode vs HTML-mode.
    // Template mode requires: configured resend_template_id on the template
    // AND no body_override from the caller (Send-to-Lender always wins via HTML).
    const rawResendId = typeof (tpl as { resend_template_id?: unknown }).resend_template_id === "string"
      ? ((tpl as { resend_template_id?: string }).resend_template_id ?? "").trim()
      : "";
    const hasBodyOverride = typeof body_override === "string" && body_override.length > 0;
    const useTemplateMode = rawResendId.length > 0 && !hasBodyOverride;

    // Sanitize variables for Resend: keys must match [A-Za-z0-9_], 1..50 chars.
    // Drop invalid keys silently; coerce values to strings; skip null/undefined.
    const sanitizedVariables: Record<string, string> = {};
    if (useTemplateMode) {
      const RESEND_VAR_KEY = /^[A-Za-z0-9_]{1,50}$/;
      for (const [k, v] of Object.entries(variables ?? {})) {
        if (!RESEND_VAR_KEY.test(k)) continue;
        if (v === undefined || v === null) continue;
        sanitizedVariables[k] = String(v);
      }
    }

    // Audit-only fields appended to payload_snapshot for both paths.
    (payloadSnapshot as Record<string, unknown>).template_mode = useTemplateMode ? "resend_template" : "html";
    if (useTemplateMode) {
      (payloadSnapshot as Record<string, unknown>).resend_template_id = rawResendId;
      (payloadSnapshot as Record<string, unknown>).resend_template_variables = sanitizedVariables;
    }
    baseLog.payload_snapshot = payloadSnapshot;

    const resendBody: Record<string, unknown> = {
      from: EMAIL_FROM,
      to: [recipient],
      ...(sanitizedCc.length > 0 ? { cc: sanitizedCc } : {}),
      reply_to: EMAIL_REPLY_TO,
      subject: renderedSubject ?? "(no subject)",
    };
    if (useTemplateMode) {
      // Resend rule: when `template` is provided, do NOT send html/text/react.
      resendBody.template = { id: rawResendId, variables: sanitizedVariables };
    } else {
      resendBody.html = `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${renderedBody.replace(/</g, "&lt;")}</pre>`;
    }

    try {
      const r = await fetch(`${RESEND_GATEWAY}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify(resendBody),
      });
      const raw = await r.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!r.ok) {
        // Resend error shape: { name, message, statusCode }
        const readable =
          (typeof data?.message === "string" && data.message) ||
          (typeof data?.error === "string" && data.error) ||
          (typeof data?.raw === "string" && data.raw) ||
          `HTTP ${r.status}`;
        const errMsg = `Resend ${r.status}: ${readable}`;
        const { data: log } = await admin
          .from("communication_logs")
          .insert({
            ...baseLog,
            provider: "resend",
            send_status: "failed",
            error_message: errMsg,
          })
          .select()
          .single();
        return new Response(
          JSON.stringify({ ok: false, error: errMsg, message: readable, log_id: log?.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const messageId = typeof data?.id === "string" ? data.id : null;
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "resend",
          send_status: "sent",
          provider_message_id: messageId,
        })
        .select()
        .single();
      return new Response(
        JSON.stringify({ ok: true, provider: "resend", message_id: messageId, log_id: log?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      const { data: log } = await admin
        .from("communication_logs")
        .insert({ ...baseLog, provider: "resend", send_status: "failed", error_message: msg })
        .select()
        .single();
      return new Response(JSON.stringify({ ok: false, error: msg, message: msg, log_id: log?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // WhatsApp via Twilio Sandbox
  if (tpl.channel === "whatsapp") {
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "twilio_sandbox",
          send_status: "failed",
          error_message: "Twilio not configured — connect the Twilio integration to enable live WhatsApp sends.",
        })
        .select()
        .single();
      return new Response(
        JSON.stringify({
          ok: false,
          error: "twilio_not_configured",
          message: "Twilio connector is not linked. Switch to mock mode or connect Twilio.",
          log_id: log?.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    try {
      // Strict E.164 validation BEFORE calling Twilio (sandbox rejects malformed numbers)
      const e164 = recipient.startsWith("whatsapp:") ? recipient.slice(9) : recipient;
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        const errMsg = `Invalid recipient: must be E.164 format with country code (e.g. +919876543210). Got: ${recipient}`;
        const { data: log } = await admin
          .from("communication_logs")
          .insert({
            ...baseLog,
            provider: "twilio_sandbox",
            send_status: "failed",
            error_message: errMsg,
          })
          .select()
          .single();
        return new Response(
          JSON.stringify({ ok: false, error: errMsg, message: errMsg, log_id: log?.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const toFormatted = `whatsapp:${e164}`;

      const form = new URLSearchParams({
        To: toFormatted,
        From: TWILIO_SANDBOX_FROM,
        Body: renderedBody,
      });

      const r = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const raw = await r.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!r.ok) {
        // Twilio error shape: { code, message, more_info, status }
        const readable =
          (typeof data?.message === "string" && data.message) ||
          (typeof data?.raw === "string" && data.raw) ||
          `HTTP ${r.status}`;
        const codePart = data?.code ? ` (code ${data.code})` : "";
        const errMsg = `Twilio ${r.status}${codePart}: ${readable}`;
        const { data: log } = await admin
          .from("communication_logs")
          .insert({
            ...baseLog,
            provider: "twilio_sandbox",
            send_status: "failed",
            error_message: errMsg,
          })
          .select()
          .single();
        return new Response(
          JSON.stringify({ ok: false, error: errMsg, message: readable, log_id: log?.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const sid = typeof data?.sid === "string" ? data.sid : null;
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "twilio_sandbox",
          send_status: "sent",
          provider_message_id: sid,
        })
        .select()
        .single();
      return new Response(
        JSON.stringify({ ok: true, provider: "twilio_sandbox", message_id: sid, log_id: log?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "twilio_sandbox",
          send_status: "failed",
          error_message: msg,
        })
        .select()
        .single();
      return new Response(JSON.stringify({ ok: false, error: msg, message: msg, log_id: log?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "unsupported channel" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
