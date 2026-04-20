import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageBadge, StatusBadge } from "./StageBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

type FilterKey = "all" | "attention" | "draft" | "documents_pending" | "on_hold" | "disbursed";
type SortKey = "updated_desc" | "created_desc" | "created_asc";

const ATTENTION_STAGES = ["documents_pending", "on_hold", "credit_query"];
const ATTENTION_STATUSES = ["pending_info", "reupload_needed", "query_raised"];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function matches(lead: Lead, filter: FilterKey): boolean {
  switch (filter) {
    case "all": return true;
    case "attention":
      return ATTENTION_STAGES.includes(lead.current_stage)
        || ATTENTION_STATUSES.includes(lead.current_status)
        || lead.duplicate_flag;
    case "draft": return lead.current_stage === "draft";
    case "documents_pending": return lead.current_stage === "documents_pending";
    case "on_hold": return lead.current_stage === "on_hold";
    case "disbursed": return lead.current_stage === "disbursed";
  }
}

export function YourLeads({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("updated_desc");

  const visible = useMemo(() => {
    const filtered = leads.filter((l) => matches(l, filter));
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "updated_desc") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sort === "created_desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return sorted.slice(0, 10);
  }, [leads, filter, sort]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 flex-wrap">
        <CardTitle className="text-base">Your Leads</CardTitle>
        <div className="flex items-center gap-2 ml-auto">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="attention">Needs Attention</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="documents_pending">Documents Pending</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="disbursed">Disbursed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Latest updated</SelectItem>
              <SelectItem value="created_desc">Newest submitted</SelectItem>
              <SelectItem value="created_asc">Oldest submitted</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="link" size="sm" onClick={() => navigate("/leads")}>
            View All →
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              {leads.length === 0
                ? "No leads submitted yet. Add your first lead or upload a batch to get started."
                : "No leads match the current filter."}
            </p>
            {leads.length === 0 && (
              <Button size="sm" onClick={() => navigate("/leads/new")}>Add Lead</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Lead ID</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Destination</TableHead>
                  <TableHead className="hidden lg:table-cell">Course</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Submitted On</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{lead.lead_id ?? "—"}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {lead.intended_study_country}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm max-w-[140px] truncate">
                      {lead.course_name}
                    </TableCell>
                    <TableCell><StageBadge stage={lead.current_stage} /></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={lead.current_status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(lead.created_at)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(lead.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
