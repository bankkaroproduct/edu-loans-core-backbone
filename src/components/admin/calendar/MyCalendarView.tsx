import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Loader2 } from "lucide-react";
import {
  useGoogleCalendarEvents,
  useRefreshCalendarEvents,
} from "@/hooks/useGoogleCalendar";
import { BlockTimeDialog } from "./BlockTimeDialog";

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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold">My Calendar</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync now
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setBlockOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Block time
            </Button>
          )}
        </div>
      </div>

      {isError && (
        <div className="mb-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          Could not load events: {(error as Error)?.message}
        </div>
      )}

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
        />
      </div>

      <BlockTimeDialog open={blockOpen} onOpenChange={setBlockOpen} />
    </Card>
  );
}
