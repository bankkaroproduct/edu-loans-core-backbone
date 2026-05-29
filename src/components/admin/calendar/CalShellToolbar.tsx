import type { ToolbarProps, View } from "react-big-calendar";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarRange,
  CalendarDays,
  Rows3,
} from "lucide-react";

const VIEWS: { key: View; label: string; Icon: typeof CalendarIcon }[] = [
  { key: "month", label: "Month", Icon: CalendarIcon },
  { key: "week", label: "Week", Icon: CalendarRange },
  { key: "day", label: "Day", Icon: CalendarDays },
  { key: "agenda", label: "Agenda", Icon: Rows3 },
];

export function CalShellToolbar(props: ToolbarProps) {
  const { label, onNavigate, onView, view } = props;
  return (
    <div className="cal-shell__toolbar">
      <div className="cal-shell__toolbar-group">
        <button type="button" className="cal-shell__today" onClick={() => onNavigate("TODAY")}>
          Today
        </button>
        <div className="cal-shell__seg">
          <button
            type="button"
            className="cal-shell__seg-btn"
            onClick={() => onNavigate("PREV")}
            aria-label="Previous"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="cal-shell__seg-btn"
            onClick={() => onNavigate("NEXT")}
            aria-label="Next"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="cal-shell__range">{label}</div>
      <div className="cal-shell__seg">
        {VIEWS.map(({ key, label: l, Icon }) => (
          <button
            key={key}
            type="button"
            className="cal-shell__seg-btn"
            data-active={view === key}
            onClick={() => onView(key)}
          >
            <Icon />
            <span>{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const stackedDayHeader = (date: Date, today: Date) => {
  const dow = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const d = date.getDate();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return { dow, d, isToday };
};
