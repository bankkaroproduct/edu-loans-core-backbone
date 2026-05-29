// GET ?user_id=<uuid>&from=<ISO>&to=<ISO>
// Returns Google Calendar events from the user's primary calendar.
// Permissions: caller must be self OR super_admin.
import { corsHeaders, json, requireAdmin, getAccessToken } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { actor } = auth;

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("user_id") || actor.appUserId;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) return json({ error: "missing_from_or_to" }, 400);
  if (targetUserId !== actor.appUserId && !actor.isSuperAdmin) {
    return json({ error: "forbidden" }, 403);
  }

  try {
    const token = await getAccessToken(actor.service, targetUserId);
    const gUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    gUrl.searchParams.set("timeMin", new Date(from).toISOString());
    gUrl.searchParams.set("timeMax", new Date(to).toISOString());
    gUrl.searchParams.set("singleEvents", "true");
    gUrl.searchParams.set("orderBy", "startTime");
    gUrl.searchParams.set("maxResults", "250");

    const res = await fetch(gUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("Google events fetch failed:", body);
      return json({ error: "google_api_error", details: body }, res.status);
    }

    await actor.service
      .from("admin_google_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", targetUserId);

    return json({
      items: (body.items ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary ?? "(no title)",
        description: e.description ?? null,
        start: e.start,
        end: e.end,
        htmlLink: e.htmlLink,
        location: e.location ?? null,
        status: e.status,
      })),
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "not_connected") return json({ error: "not_connected" }, 409);
    if (msg === "refresh_failed") return json({ error: "refresh_failed" }, 401);
    console.error("events error:", e);
    return json({ error: msg }, 500);
  }
});
