import { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { RefreshCw, Loader2, Check, AlertCircle, X } from "lucide-react";
import {
  useTeamGoogleConnections,
  fetchCalendarEvents,
  useRefreshCalendarEvents,
  type GCalEvent,
} from "@/hooks/useGoogleCalendar";
import { useQuery } from "@tanstack/react-query";
import { CalShellToolbar, stackedDayHeader } from "./CalShellToolbar";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

function colorFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
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
        title: `${ev.summary}${owner ? ` - ${owner.google_name ?? owner.google_email}` : ""}`,
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

  const today = useMemo(() => new Date(), []);
  const scrollToTime = useMemo(() => new Date(0, 0, 0, 8, 0, 0), []);

  // Render-only dismissal: cleared automatically whenever a new errors payload arrives.
  const errorCount = teamQuery.data?.errors?.length ?? 0;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const errorKey = teamQuery.data?.errors
    ? teamQuery.data.errors.map((e) => e.uid).sort().join("|")
    : null;
  const showError = errorCount > 0 && errorKey !== dismissedKey;

  return (
    <div className="cal-shell">
      <div className="cal-shell__panel">
        <div className="cal-shell__panel-head">
          <h2 className="cal-shell__panel-title">Team Calendar</h2>
          <button
            type="button"
            className="cal-shell__sync"
            onClick={refresh}
            disabled={teamQuery.isFetching}
          >
            {teamQuery.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Sync now
          </button>
        </div>

        {connLoading ? (
          <div style={{ padding: 22, fontSize: 13, color: "var(--cal-fg-3)" }}>
            Loading team connections…
          </div>
        ) : (connections?.length ?? 0) === 0 ? (
          <div style={{ padding: 22, fontSize: 13, color: "var(--cal-fg-3)" }}>
            No admins have connected their Google Calendar yet.
          </div>
        ) : (
          <div className="cal-shell__split">
            <aside className="cal-shell__rail">
              <p className="cal-shell__rail-label">Team Members</p>
              {connections!.map((c) => {
                const on = selected.has(c.user_id);
                const color = colorFor(c.user_id);
                const name = c.google_name ?? c.google_email;
                return (
                  <button
                    key={c.user_id}
                    type="button"
                    className="cal-shell__rail-row"
                    onClick={() => toggle(c.user_id)}
                    aria-pressed={on}
                  >
                    <span
                      className="cal-shell__rail-check"
                      data-on={on}
                      style={on ? { background: color } : undefined}
                    >
                      {on && <Check />}
                    </span>
                    <span
                      className="cal-shell__rail-avatar"
                      style={{ background: color }}
                    >
                      {initialsOf(name)}
                    </span>
                    <span className="cal-shell__rail-name">{name}</span>
                  </button>
                );
              })}
            </aside>

            <div className="cal-shell__right">
              {showError && (
                <div className="cal-shell__error" role="alert">
                  <AlertCircle className="cal-shell__error-icon" />
                  <span className="cal-shell__error-text">
                    Could not load events for {errorCount} admin(s).
                  </span>
                  <button
                    type="button"
                    className="cal-shell__error-close"
                    aria-label="Dismiss"
                    onClick={() => setDismissedKey(errorKey)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="cal-shell__cal">
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
                  scrollToTime={scrollToTime}
                  step={30}
                  timeslots={2}
                  components={{
                    toolbar: CalShellToolbar,
                    week: {
                      header: ({ date: d }) => {
                        const { dow, d: dd, isToday } = stackedDayHeader(d, today);
                        return (
                          <div className="rbc-day-header-stacked" data-today={isToday}>
                            <span className="dow">{dow}</span>
                            <span className="date">{dd}</span>
                          </div>
                        );
                      },
                    },
                  }}
                  eventPropGetter={(event) => ({
                    style: {
                      backgroundColor: (event.resource as { color: string }).color,
                      border: "none",
                    },
                  })}
                />
                <div className="cal-shell__fade" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
