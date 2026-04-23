import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const TWILIO_SANDBOX_FROM = "whatsapp:+14155238886";

interface SendInput {
  template_key: string;
  recipient: string;
  lead_id?: string | null;
  mode: "mock" | "demo_live";
  variables?: Record<string, string | number | null | undefined>;
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

  const { template_key, recipient, lead_id, mode, variables = {} } = body;
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

  const renderedSubject = tpl.subject ? renderTemplate(tpl.subject, variables) : null;
  const renderedBody = renderTemplate(tpl.body, variables);

  const payloadSnapshot = {
    subject: renderedSubject,
    body: renderedBody,
    variables,
    template: { key: tpl.template_key, channel: tpl.channel },
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

    try {
      const r = await fetch(`${RESEND_GATEWAY}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "EduLoans <onboarding@resend.dev>",
          to: [recipient],
          subject: renderedSubject ?? "(no subject)",
          html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${renderedBody.replace(/</g, "&lt;")}</pre>`,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        const { data: log } = await admin
          .from("communication_logs")
          .insert({
            ...baseLog,
            provider: "resend",
            send_status: "failed",
            error_message: `Resend [${r.status}]: ${JSON.stringify(data)}`,
          })
          .select()
          .single();
        return new Response(
          JSON.stringify({ ok: false, error: data, log_id: log?.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "resend",
          send_status: "sent",
          provider_message_id: data?.id ?? null,
        })
        .select()
        .single();
      return new Response(
        JSON.stringify({ ok: true, provider: "resend", message_id: data?.id, log_id: log?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      const { data: log } = await admin
        .from("communication_logs")
        .insert({ ...baseLog, provider: "resend", send_status: "failed", error_message: msg })
        .select()
        .single();
      return new Response(JSON.stringify({ ok: false, error: msg, log_id: log?.id }), {
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
      const toFormatted = recipient.startsWith("whatsapp:")
        ? recipient
        : `whatsapp:${recipient.startsWith("+") ? recipient : "+" + recipient}`;

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
      const data = await r.json();
      if (!r.ok) {
        const { data: log } = await admin
          .from("communication_logs")
          .insert({
            ...baseLog,
            provider: "twilio_sandbox",
            send_status: "failed",
            error_message: `Twilio [${r.status}]: ${JSON.stringify(data)}`,
          })
          .select()
          .single();
        return new Response(
          JSON.stringify({ ok: false, error: data, log_id: log?.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: log } = await admin
        .from("communication_logs")
        .insert({
          ...baseLog,
          provider: "twilio_sandbox",
          send_status: "sent",
          provider_message_id: data?.sid ?? null,
        })
        .select()
        .single();
      return new Response(
        JSON.stringify({ ok: true, provider: "twilio_sandbox", message_id: data?.sid, log_id: log?.id }),
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
      return new Response(JSON.stringify({ ok: false, error: msg, log_id: log?.id }), {
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
