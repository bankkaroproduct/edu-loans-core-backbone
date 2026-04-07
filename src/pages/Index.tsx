import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Upload, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

interface StageCounts {
  total: number;
  draft: number;
  submitted: number;
  in_review: number;
  disbursed: number;
  rejected: number;
}

const stageColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  under_initial_review: "bg-accent text-accent-foreground",
  documents_pending: "bg-destructive/10 text-destructive",
  documents_under_review: "bg-accent text-accent-foreground",
  bre_evaluated: "bg-primary/10 text-primary",
  sent_to_lender: "bg-primary/10 text-primary",
  login_submitted: "bg-primary/10 text-primary",
  credit_query: "bg-destructive/10 text-destructive",
  sanction_received: "bg-primary/20 text-primary",
  disbursed: "bg-primary/20 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  dropped: "bg-muted text-muted-foreground",
  on_hold: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<StageCounts>({ total: 0, draft: 0, submitted: 0, in_review: 0, disbursed: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: allLeads } = await supabase
        .from("student_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (allLeads) {
        setLeads(allLeads);
        setCounts({
          total: allLeads.length,
          draft: allLeads.filter(l => l.current_stage === "draft").length,
          submitted: allLeads.filter(l => l.current_stage === "submitted").length,
          in_review: allLeads.filter(l => ["under_initial_review", "documents_pending", "documents_under_review"].includes(l.current_stage)).length,
          disbursed: allLeads.filter(l => l.current_stage === "disbursed").length,
          rejected: allLeads.filter(l => l.current_stage === "rejected").length,
        });
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const recentLeads = leads.slice(0, 5);
  const formatStage = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {appUser?.full_name ?? "User"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/leads/new")} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Lead
          </Button>
          <Button variant="outline" onClick={() => navigate("/bulk-upload")} size="sm">
            <Upload className="mr-1 h-4 w-4" /> Bulk Upload
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Leads" value={counts.total} icon={FileText} loading={loading} />
        <StatCard title="Submitted" value={counts.submitted} icon={TrendingUp} loading={loading} />
        <StatCard title="Under Review" value={counts.in_review} icon={Clock} loading={loading} />
        <StatCard title="Disbursed" value={counts.disbursed} icon={CheckCircle} loading={loading} />
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : counts.draft}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending submission</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : counts.rejected}</p>
            <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading || counts.total === 0 ? "—" : `${Math.round((counts.disbursed / counts.total) * 100)}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Disbursed / Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Leads</CardTitle>
          <Button variant="link" size="sm" onClick={() => navigate("/leads")}>
            View All →
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
          ) : recentLeads.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No leads yet. Add your first lead to get started.</p>
              <Button className="mt-4" onClick={() => navigate("/leads/new")}>
                <Plus className="mr-1 h-4 w-4" /> Add Lead
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <TableCell className="font-mono text-sm">{lead.lead_id ?? "—"}</TableCell>
                    <TableCell>{lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim()}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{lead.course_name}</TableCell>
                    <TableCell>{lead.intended_study_country}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={stageColors[lead.current_stage] ?? ""}>
                        {formatStage(lead.current_stage)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: number; icon: React.ElementType; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{loading ? "—" : value}</p>
      </CardContent>
    </Card>
  );
}
