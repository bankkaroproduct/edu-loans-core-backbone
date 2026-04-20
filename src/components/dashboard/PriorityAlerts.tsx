import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileWarning, UploadCloud, Pause, Clock, MessageSquare, CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface AlertItem {
  id: string;
  leadId: string | null;
  studentName: string;
  reason: string;
  category: "docs_pending" | "reupload" | "on_hold" | "upload_error" | "attention" | "stuck" | "payout_clarification" | "admin_remark";
  updatedAt: string;
  entityId: string;
}

const categoryConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  docs_pending: { icon: FileWarning, label: "Documents Pending", color: "text-orange-600" },
  reupload: { icon: FileWarning, label: "Reupload Needed", color: "text-rose-600" },
  on_hold: { icon: Pause, label: "On Hold", color: "text-yellow-600" },
  upload_error: { icon: UploadCloud, label: "Upload Error", color: "text-destructive" },
  attention: { icon: AlertTriangle, label: "Needs Attention", color: "text-amber-600" },
  stuck: { icon: Clock, label: "Stuck Lead", color: "text-orange-500" },
  payout_clarification: { icon: CreditCard, label: "Payout Clarification", color: "text-blue-600" },
  admin_remark: { icon: MessageSquare, label: "Admin Remark", color: "text-indigo-600" },
};

// Map category → high-level type bucket
type AlertType = "bulk" | "lead" | "document";
function categoryToType(cat: AlertItem["category"]): AlertType {
  if (cat === "upload_error") return "bulk";
  if (cat === "docs_pending" || cat === "reupload") return "document";
  return "lead";
}

// Priority weight: lower = higher priority
const priorityWeight: Record<AlertItem["category"], number> = {
  upload_error: 1,
  reupload: 2,
  docs_pending: 3,
  on_hold: 4,
  payout_clarification: 5,
  stuck: 6,
  attention: 7,
  admin_remark: 8,
};

type SortOption = "latest" | "oldest" | "priority";

export function PriorityAlerts({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AlertType>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sort, setSort] = useState<SortOption>("latest");

  const handleAlertClick = (alert: AlertItem) => {
    switch (alert.category) {
      case "upload_error":
        navigate("/bulk-upload");
        break;
      case "payout_clarification":
        navigate("/payouts");
        break;
      default:
        navigate(`/leads/${alert.entityId}`);
    }
  };

  const filtered = useMemo(() => {
    let out = alerts.filter((a) => {
      if (statusFilter !== "all" && a.category !== statusFilter) return false;
      if (typeFilter !== "all" && categoryToType(a.category) !== typeFilter) return false;
      if (dateFrom && a.updatedAt < dateFrom) return false;
      if (dateTo && a.updatedAt > dateTo + "T23:59:59") return false;
      return true;
    });

    if (sort === "latest") {
      out = [...out].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sort === "oldest") {
      out = [...out].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    } else {
      out = [...out].sort((a, b) => priorityWeight[a.category] - priorityWeight[b.category]);
    }
    return out;
  }, [alerts, statusFilter, typeFilter, dateFrom, dateTo, sort]);

  const hasActiveFilters =
    statusFilter !== "all" || typeFilter !== "all" || !!dateFrom || !!dateTo || sort !== "latest";

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
    setSort("latest");
  };

  return (
    <Card className="border-l-[5px] border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20 shadow-md">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Action Center
          {!loading && (
            <span className="ml-auto text-xs font-semibold bg-destructive/10 text-destructive px-2.5 py-1 rounded-full">
              {filtered.length}
              {filtered.length !== alerts.length && (
                <span className="opacity-60"> / {alerts.length}</span>
              )}
            </span>
          )}
        </CardTitle>

        {/* Filter / Sort toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[170px] text-xs bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="h-9 w-[140px] text-xs bg-background">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="lead">Lead issues</SelectItem>
              <SelectItem value="document">Document issues</SelectItem>
              <SelectItem value="bulk">Bulk upload</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-[140px] text-xs bg-background"
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-[140px] text-xs bg-background"
            aria-label="To date"
          />

          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-9 w-[130px] text-xs bg-background">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              All clear! No actions required right now. Keep submitting leads and uploading documents.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No alerts match your filters.{" "}
              <button onClick={clearFilters} className="text-primary font-medium hover:underline">
                Clear filters
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {filtered.slice(0, 15).map((alert) => {
              const config = categoryConfig[alert.category] ?? categoryConfig.attention;
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-amber-200/60 dark:border-amber-800/30 bg-white/70 dark:bg-background/50 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 cursor-pointer transition-colors"
                  onClick={() => handleAlertClick(alert)}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {alert.leadId && (
                        <span className="text-xs font-mono text-muted-foreground">{alert.leadId}</span>
                      )}
                      <span className="text-sm font-medium truncate">{alert.studentName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.reason}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    {new Date(alert.updatedAt).toLocaleDateString()}
                    <span className="text-primary font-semibold">Resolve →</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
