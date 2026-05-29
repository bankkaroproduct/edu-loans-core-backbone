import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Plus } from "lucide-react";
import {
  useGoogleCalendarEvents,
  useRefreshCalendarEvents,
} from "@/hooks/useGoogleCalendar";
import { BlockTimeDialog } from "./BlockTimeDialog";
import { CalShellToolbar, stackedDayHeader } from "./CalShellToolbar";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface Props {
  userId: string;
  canCreate: boolean;
}

export function MyCalendarView({ userId, canCreate }: Props) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [blockOpen, setBlockOpen] = useState(false);
  const refresh = useRefreshCalendarEvents();

  const { from, to } = useMemo(() => {
    const ref = date;
    return {
      from: new Date(startOfMonth(ref).getTime() - 7 * 86400_000).toISOString(),
      to: new Date(endOfMonth(ref).getTime() + 7 * 86400_000).toISOString(),
    };
  }, [date]);

  const { data, isLoading, isError, error } = useGoogleCalendarEvents(userId, from, to);

  const events = useMemo(() => {
    return (data ?? []).map((e) => {
      const start = e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date!);
      const end = e.end.dateTime ? new Date(e.end.dateTime) : new Date(e.end.date!);
      const allDay = !e.start.dateTime;
      return { id: e.id, title: e.summary, start, end, allDay, resource: e };
    });
  }, [data]);

  const today = useMemo(() => new Date(), []);
  const scrollToTime = useMemo(() => new Date(0, 0, 0, 8, 0, 0), []);

  return (
    <div className="cal-shell">
      <div className="cal-shell__panel">
        <div className="cal-shell__panel-head">
          <h2 className="cal-shell__panel-title">My Calendar</h2>
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button
              type="button"
              className="cal-shell__sync"
              onClick={refresh}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Sync now
            </button>
            {canCreate && (
              <Button size="sm" onClick={() => setBlockOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Block time
              </Button>
            )}
          </div>
        </div>

        {isError && (
          <div className="cal-shell__error" role="alert">
            <span className="cal-shell__error-text">
              Could not load events: {(error as Error)?.message}
            </span>
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
          />
          <div className="cal-shell__fade" />
        </div>
      </div>

      <BlockTimeDialog open={blockOpen} onOpenChange={setBlockOpen} />
    </div>
  );
}
