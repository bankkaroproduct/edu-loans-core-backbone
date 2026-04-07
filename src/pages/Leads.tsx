import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Upload } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type Stage = Database["public"]["Enums"]["lead_stage_enum"];

const stageColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  under_initial_review: "bg-accent text-accent-foreground",
  documents_pending: "bg-destructive/10 text-destructive",
  documents_under_review: "bg-accent text-accent-foreground",
  bre_evaluated: "bg-primary/10 text-primary",
  sent_to_lender: "bg-primary/10 text-primary",
  login_submitted: "bg-primary/15 text-primary",
  credit_query: "bg-destructive/10 text-destructive",
  sanction_received: "bg-primary/20 text-primary",
  disbursed: "bg-primary/20 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  dropped: "bg-muted text-muted-foreground",
  on_hold: "bg-muted text-muted-foreground",
};

const allStages: Stage[] = [
  "draft", "submitted", "under_initial_review", "documents_pending",
  "documents_under_review", "bre_evaluated", "sent_to_lender",
  "login_submitted", "credit_query", "sanction_received",
  "disbursed", "rejected", "dropped", "on_hold",
];

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  useEffect(() => {
    const fetch = async () => {
      let q = supabase
        .from("student_leads")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);

      if (stageFilter && stageFilter !== "all") {
        q = q.eq("current_stage", stageFilter as Stage);
      }

      const { data } = await q;
      setLeads(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [stageFilter]);

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.student_first_name.toLowerCase().includes(s) ||
      (l.student_last_name ?? "").toLowerCase().includes(s) ||
      (l.student_email ?? "").toLowerCase().includes(s) ||
      l.student_phone.includes(s) ||
      (l.lead_id ?? "").toLowerCase().includes(s) ||
      l.course_name.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Leads</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/leads/new")} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Lead
          </Button>
          <Button variant="outline" onClick={() => navigate("/bulk-upload")} size="sm">
            <Upload className="mr-1 h-4 w-4" /> Bulk Upload
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, lead ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {allStages.map((s) => (
                  <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading leads...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No leads found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <TableCell className="font-mono text-sm">{lead.lead_id ?? "—"}</TableCell>
                    <TableCell>{lead.student_full_name ?? lead.student_first_name}</TableCell>
                    <TableCell className="text-sm">{lead.student_phone}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{lead.course_name}</TableCell>
                    <TableCell>{lead.intended_study_country}</TableCell>
                    <TableCell className="text-sm">{lead.intake_term} {lead.intake_year}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={stageColors[lead.current_stage] ?? ""}>{fmt(lead.current_stage)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</TableCell>
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
