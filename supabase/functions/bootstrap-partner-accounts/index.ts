// One-shot bootstrap — DISABLED after successful execution on 2026-05-07.
// Returns 410 Gone for any request. Re-enable by restoring the prior
// implementation from git history if you ever need to rebuild this flow.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "disabled: one-time bootstrap already executed" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
