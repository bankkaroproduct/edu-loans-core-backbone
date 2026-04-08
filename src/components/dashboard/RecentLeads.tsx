import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageBadge, StatusBadge } from "./StageBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

export function RecentLeads({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Leads</CardTitle>
        <Button variant="link" size="sm" onClick={() => navigate("/leads")}>
          View All →
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              No leads submitted yet. Add your first lead or upload a batch to get started.
            </p>
            <Button size="sm" onClick={() => navigate("/leads/new")}>Add Lead</Button>
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
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
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
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(lead.updated_at).toLocaleDateString()}
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
