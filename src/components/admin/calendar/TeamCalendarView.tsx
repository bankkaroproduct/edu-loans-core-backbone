import { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useTeamGoogleConnections,
  fetchCalendarEvents,
  useRefreshCalendarEvents,
  type GCalEvent,
} from "@/hooks/useGoogleCalendar";
import { useQuery } from "@tanstack/react-query";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Deterministic color per user (HSL from semantic primary range).
function colorFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

export function TeamCalendarView() {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const refresh = useRefreshCalendarEvents();

  const { data: connections, isLoading: connLoading } = useTeamGoogleConnections(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (connections && selected.size === 0 && connections.length > 0) {
      setSelected(new Set(connections.map((c) => c.user_id)));
    }
  }, [connections, selected.size]);

  const { from, to } = useMemo(() => ({
    from: new Date(startOfMonth(date).getTime() - 7 * 86400_000).toISOString(),
    to: new Date(endOfMonth(date).getTime() + 7 * 86400_000).toISOString(),
  }), [date]);

  const activeIds = useMemo(
    () => (connections ?? []).filter((c) => selected.has(c.user_id)).map((c) => c.user_id),
    [connections, selected],
  );

  const teamQuery = useQuery({
    queryKey: ["gcal-team-events", activeIds.sort().join(","), from, to],
    enabled: activeIds.length > 0,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const results = await Promise.allSettled(
        activeIds.map((uid) => fetchCalendarEvents(uid, from, to).then((items) => ({ uid, items }))),
      );
      const merged: Array<{ uid: string; ev: GCalEvent }> = [];
      const errors: Array<{ uid: string; err: string }> = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          for (const ev of r.value.items) merged.push({ uid: r.value.uid, ev });
        } else {
          errors.push({ uid: activeIds[i], err: String(r.reason?.message ?? r.reason) });
        }
      });
      return { merged, errors };
    },
  });

  const events = useMemo(() => {
    const items = teamQuery.data?.merged ?? [];
    return items.map(({ uid, ev }) => {
      const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date!);
      const end = ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(ev.end.date!);
      const allDay = !ev.start.dateTime;
      const owner = connections?.find((c) => c.user_id === uid);
      return {
        id: `${uid}:${ev.id}`,
        title: `${ev.summary}${owner ? ` — ${owner.google_name ?? owner.google_email}` : ""}`,
        start, end, allDay,
        resource: { ev, uid, color: colorFor(uid) },
      };
    });
  }, [teamQuery.data, connections]);

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold">Team Calendar</h2>
        <Button size="sm" variant="outline" onClick={refresh} disabled={teamQuery.isFetching}>
          {teamQuery.isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync now
        </Button>
      </div>

      {connLoading ? (
        <div className="text-sm text-muted-foreground">Loading team connections…</div>
      ) : (connections?.length ?? 0) === 0 ? (
        <div className="text-sm text-muted-foreground">
          No admins have connected their Google Calendar yet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            {connections!.map((c) => (
              <label key={c.user_id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(c.user_id)}
                  onCheckedChange={() => toggle(c.user_id)}
                />
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: colorFor(c.user_id) }}
                />
                <span>{c.google_name ?? c.google_email}</span>
              </label>
            ))}
          </div>

          {teamQuery.data?.errors?.length ? (
            <div className="mb-3 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
              Could not load events for {teamQuery.data.errors.length} admin(s).
            </div>
          ) : null}

          <div style={{ height: 680 }}>
            <Calendar
              localizer={localizer}
              events={events}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={["month", "week", "day", "agenda"]}
              min={new Date(2024, 0, 1, 7, 0)}
              max={new Date(2024, 0, 1, 22, 0)}
              step={30}
              timeslots={2}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: (event.resource as { color: string }).color,
                  border: "none",
                },
              })}
            />
          </div>
        </>
      )}
    </Card>
  );
}
