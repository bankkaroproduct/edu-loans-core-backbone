import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar,
  Download,
  Loader2,
  Sheet,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  buildFilename,
  downloadCSV,
  downloadXLSX,
  REPORT_CAP_MESSAGE,
  REPORT_ROW_CAP,
  type ReportResult,
} from "@/lib/reportExports";

export type ReportAccentKey =
  | "leads"
  | "stage"
  | "documents"
  | "editRequests"
  | "partners";

const ACCENTS: Record<ReportAccentKey, { bg: string; bg2: string; fg: string }> = {
  leads:        { bg: "#EEF2FF", bg2: "#DCE3FF", fg: "#0036DA" },
  stage:        { bg: "#F3EEFF", bg2: "#E2D6FF", fg: "#6B2BD9" },
  documents:    { bg: "#FFF5ED", bg2: "#FFE3CC", fg: "#C2570E" },
  editRequests: { bg: "#ECFBF3", bg2: "#C9F1DB", fg: "#117A3A" },
  partners:     { bg: "#EAEDFB", bg2: "#D5DBF5", fg: "#2C40AA" },
};

interface Props {
  title: string;
  description: string;
  slug: string;
  dateFieldHint: string;
  accent: ReportAccentKey;
  Icon: LucideIcon;
  fetchCount: () => Promise<number>;
  fetchData: () => Promise<ReportResult<any>>;
  filterVersion: string;
  isLast?: boolean;
}

export function ReportListRow({
  title,
  description,
  slug,
  dateFieldHint,
  accent,
  Icon,
  fetchCount,
  fetchData,
  filterVersion,
  isLast,
}: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    fetchCount()
      .then((n) => { if (!cancelled) setCount(n); })
      .catch(() => { if (!cancelled) setCount(0); })
      .finally(() => { if (!cancelled) setLoadingCount(false); });
    return () => { cancelled = true; };
  }, [filterVersion, fetchCount]);

  const capped = count !== null && count > REPORT_ROW_CAP;
  const empty = count === 0;
  const disabled = busy !== null || empty || capped || loadingCount;

  const handleExport = async (kind: "csv" | "xlsx") => {
    setBusy(kind);
    try {
      const result = await fetchData();
      if (result.error) {
        toast({ title: "Export failed", description: result.error, variant: "destructive" });
        return;
      }
      if (result.capped) {
        toast({ title: "Too many rows", description: REPORT_CAP_MESSAGE, variant: "destructive" });
        return;
      }
      if (!result.rows.length) {
        toast({ title: "No rows", description: "No data matches the current filters." });
        return;
      }
      const fname = buildFilename(slug, kind);
      if (kind === "csv") downloadCSV(result.rows, fname);
      else downloadXLSX(result.rows, fname, title);
      toast({ title: "Export ready", description: `${result.rows.length} rows → ${fname}` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const a = ACCENTS[accent];
  const unitLabel = count === 1 ? "ROW" : "ROWS";
  const countDisplay = loadingCount ? "…" : (count ?? 0).toLocaleString();

  const disabledReason = capped
    ? REPORT_CAP_MESSAGE
    : empty
    ? "No rows match current filters"
    : loadingCount
    ? "Loading…"
    : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 168px 96px auto",
        alignItems: "center",
        gap: 20,
        padding: "18px 22px",
        borderBottom: isLast ? "none" : "1px solid #F1F3F6",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FCFCFE")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      {/* Col 1 — identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 42, height: 42, borderRadius: 11,
            display: "grid", placeItems: "center",
            background: `linear-gradient(135deg, ${a.bg} 0%, ${a.bg2} 100%)`,
            color: a.fg, flexShrink: 0,
          }}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "14.5px", fontWeight: 800, letterSpacing: "-0.015em",
              color: "hsl(var(--foreground))", lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12, lineHeight: 1.45, fontWeight: 500,
              color: "hsl(var(--muted-foreground))", marginTop: 3,
              textWrap: "pretty" as any,
            }}
          >
            {description}
          </div>
        </div>
      </div>

      {/* Col 2 — date basis */}
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: "11.5px", fontWeight: 600, color: "#6B7684",
        }}
      >
        <Calendar size={15} strokeWidth={2} />
        <span>{dateFieldHint}</span>
      </div>

      {/* Col 3 — row count */}
      <div style={{ textAlign: "right" }}>
        {capped ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "hsl(var(--destructive))" }}>
                  <AlertTriangle size={13} />
                  <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {countDisplay}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{REPORT_CAP_MESSAGE}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div
            style={{
              fontSize: 14, fontWeight: 800,
              color: "hsl(var(--foreground))", fontVariantNumeric: "tabular-nums",
            }}
          >
            {countDisplay}
          </div>
        )}
        <div
          style={{
            fontSize: 10, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.04em", color: "#6B7684", marginTop: 1,
          }}
        >
          {capped ? "CAPPED" : unitLabel}
        </div>
      </div>

      {/* Col 4 — actions */}
      <TooltipProvider delayDuration={150}>
        <div style={{ display: "flex", gap: 8 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  disabled={disabled}
                  style={{
                    height: 36, padding: "0 14px", borderRadius: 8,
                    border: "1px solid #E0E4EA", background: "#FFFFFF",
                    color: "hsl(var(--foreground))",
                    fontSize: "12.5px", fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (disabled) return;
                    e.currentTarget.style.background = "#FAFBFC";
                    e.currentTarget.style.borderColor = "#CBD2DA";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.borderColor = "#E0E4EA";
                  }}
                >
                  {busy === "csv" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  CSV
                </button>
              </span>
            </TooltipTrigger>
            {disabledReason && <TooltipContent>{disabledReason}</TooltipContent>}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  disabled={disabled}
                  style={{
                    height: 36, padding: "0 14px", borderRadius: 8,
                    border: "1px solid #1C1B1F", background: "#1C1B1F",
                    color: "#FFFFFF",
                    fontSize: "12.5px", fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (disabled) return;
                    e.currentTarget.style.background = "#000000";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#1C1B1F";
                  }}
                >
                  {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <Sheet size={16} />}
                  XLSX
                </button>
              </span>
            </TooltipTrigger>
            {disabledReason && <TooltipContent>{disabledReason}</TooltipContent>}
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
