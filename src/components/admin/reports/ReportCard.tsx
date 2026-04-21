import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, FileSpreadsheet, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  buildFilename,
  downloadCSV,
  downloadXLSX,
  REPORT_CAP_MESSAGE,
  REPORT_ROW_CAP,
  type ReportResult,
} from "@/lib/reportExports";

interface Props {
  title: string;
  description: string;
  slug: string;
  /** Returns the live row count (uses head:true count). */
  fetchCount: () => Promise<number>;
  /** Returns the full data payload. Called only when user clicks export. */
  fetchData: () => Promise<ReportResult<any>>;
  /** Changes when filters change so we re-fetch the count. */
  filterVersion: string;
  icon: React.ReactNode;
  /** Optional muted helper text indicating which date field the global range applies to. */
  dateFieldHint?: string;
}

export function ReportCard({ title, description, slug, fetchCount, fetchData, filterVersion, icon, dateFieldHint }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    fetchCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoadingCount(false);
      });
    return () => {
      cancelled = true;
    };
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

  return (
    <Card className="flex flex-col border-border/60 hover:shadow-sm transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
              {dateFieldHint && (
                <p className="text-[10px] text-muted-foreground/80 mt-1 italic">{dateFieldHint}</p>
              )}
            </div>
          </div>
          <Badge
            variant={capped ? "destructive" : empty ? "outline" : "secondary"}
            className="text-[10px] shrink-0"
          >
            {loadingCount ? "…" : capped ? `${count!.toLocaleString()} (capped)` : `${(count ?? 0).toLocaleString()} rows`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 mt-auto space-y-2">
        {capped && (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-destructive/10 text-destructive text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{REPORT_CAP_MESSAGE}</span>
          </div>
        )}
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    onClick={() => handleExport("csv")}
                    disabled={disabled}
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs"
                  >
                    {busy === "csv" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    CSV
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled && (
                <TooltipContent>
                  {capped ? REPORT_CAP_MESSAGE : empty ? "No rows match current filters" : "Loading…"}
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    onClick={() => handleExport("xlsx")}
                    disabled={disabled}
                    size="sm"
                    className="w-full h-8 text-xs"
                  >
                    {busy === "xlsx" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />}
                    XLSX
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled && (
                <TooltipContent>
                  {capped ? REPORT_CAP_MESSAGE : empty ? "No rows match current filters" : "Loading…"}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
