// POST { summary, description?, start_iso, end_iso }
// Creates a calendar event on the caller's own primary calendar.
import { corsHeaders, json, requireAdmin, getAccessToken } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { actor } = auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const description = typeof body.description === "string" ? body.description : "";
  const startIso = typeof body.start_iso === "string" ? body.start_iso : "";
  const endIso = typeof body.end_iso === "string" ? body.end_iso : "";

  if (!summary) return json({ error: "summary_required" }, 400);
  if (!startIso || !endIso) return json({ error: "start_end_required" }, 400);
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return json({ error: "invalid_dates" }, 400);
  }
  if (endDate <= startDate) return json({ error: "end_must_be_after_start" }, 400);

  try {
    const token = await getAccessToken(actor.service, actor.appUserId);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary,
          description,
          start: { dateTime: startDate.toISOString(), timeZone: tz },
          end: { dateTime: endDate.toISOString(), timeZone: tz },
        }),
      },
    );
    const event = await res.json();
    if (!res.ok) {
      console.error("Event create failed:", event);
      return json({ error: "google_api_error", details: event }, res.status);
    }
    return json({ ok: true, event });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "not_connected") return json({ error: "not_connected" }, 409);
    if (msg === "refresh_failed") return json({ error: "refresh_failed" }, 401);
    console.error("create event error:", e);
    return json({ error: msg }, 500);
  }
});
