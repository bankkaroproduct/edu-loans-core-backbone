import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, FileText, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type History = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [leadRes, histRes, notesRes] = await Promise.all([
        supabase.from("student_leads").select("*").eq("id", id).maybeSingle(),
        supabase.from("lead_stage_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      ]);
      setLead(leadRes.data);
      setHistory(histRes.data ?? []);
      setNotes(notesRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  const addNote = async () => {
    if (!newNote.trim() || !id || !appUser) return;
    setAddingNote(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: id,
      note_text: newNote.trim(),
      note_type: "partner_visible",
      created_by: appUser.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Note added");
      setNewNote("");
      const { data } = await supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false });
      setNotes(data ?? []);
    }
    setAddingNote(false);
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground">Loading lead details...</p>;
  if (!lead) return <p className="text-center py-12 text-muted-foreground">Lead not found</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/leads")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{lead.student_full_name ?? lead.student_first_name}</h1>
            <Badge variant="outline" className="font-mono">{lead.lead_id ?? "Draft"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{lead.course_name} • {lead.intended_study_country} • {lead.intake_term} {lead.intake_year}</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{fmt(lead.current_stage)}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Lead Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Details */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Student Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <InfoRow label="Name" value={lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`} />
                <InfoRow label="Email" value={lead.student_email} />
                <InfoRow label="Phone" value={lead.student_phone} />
                <InfoRow label="WhatsApp" value={lead.student_whatsapp} />
                <InfoRow label="City" value={lead.city} />
                <InfoRow label="State" value={lead.state} />
                <InfoRow label="Country" value={lead.country_of_residence} />
              </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Financial Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <InfoRow label="Loan Amount" value={lead.loan_amount_required ? `₹${Number(lead.loan_amount_required).toLocaleString()}` : null} />
                <InfoRow label="Co-Applicant" value={lead.coapplicant_name} />
                <InfoRow label="Relation" value={lead.coapplicant_relation} />
                <InfoRow label="Co-Applicant Income" value={lead.coapplicant_income ? `₹${Number(lead.coapplicant_income).toLocaleString()}` : null} />
                <InfoRow label="Collateral" value={lead.collateral_available ? "Yes" : "No"} />
                <InfoRow label="Collateral Notes" value={lead.collateral_notes} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1"
                  rows={2}
                />
                <Button size="icon" onClick={addNote} disabled={addingNote || !newNote.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <Separator />
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">{fmt(n.note_type)}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm">{n.note_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" /> Lifecycle Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Current state */}
              <div className="mb-4 p-3 rounded-md bg-muted">
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="font-medium">{fmt(lead.current_stage)}</p>
                <p className="text-sm text-muted-foreground">{fmt(lead.current_status)}</p>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No stage changes recorded</p>
              ) : (
                <div className="space-y-4">
                  {history.map((h) => (
                    <div key={h.id} className="relative pl-4 border-l-2 border-border pb-4">
                      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                      <p className="text-sm font-medium">{fmt(h.new_stage)}</p>
                      <p className="text-xs text-muted-foreground">{fmt(h.new_status)}</p>
                      {h.previous_stage && (
                        <p className="text-xs text-muted-foreground mt-1">From: {fmt(h.previous_stage)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-4">Document management coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
