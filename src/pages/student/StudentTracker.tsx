import { useNavigate } from "react-router-dom";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  CheckCircle2, Circle, ArrowRight, Shield, Compass, HeartHandshake,
  FileText, Building2, Clock, AlertTriangle, Loader2, ExternalLink,
  Upload, Eye, HelpCircle, Activity, ChevronRight, TrendingUp,
  CircleCheck, CircleDot, CircleAlert, Info, Phone, Mail
} from "lucide-react";
import { formatINRCompact } from "@/lib/formatCurrency";

// --- Stage mapping & journey ---
const JOURNEY_STEPS = [
  { key: "submitted", label: "Application Submitted", desc: "Your application has been received", timeGuide: "" },
  { key: "document_review", label: "Document Review", desc: "Documents are being collected and verified", timeGuide: "Typically 2–5 days" },
  { key: "lender_matching", label: "Lender Matching", desc: "Matching your profile with suitable lenders", timeGuide: "Typically 1–3 days" },
  { key: "application_process", label: "Application in Process", desc: "Your case has been forwarded to the lender", timeGuide: "Typically 5–10 days" },
  { key: "query_review", label: "Query Review", desc: "Handling any queries from the lender", timeGuide: "Varies by query" },
  { key: "approval", label: "Approval & Sanction", desc: "Lender decision on your application", timeGuide: "Typically 3–7 days" },
  { key: "disbursal", label: "Disbursal", desc: "Loan funds released to your institution", timeGuide: "Typically 2–5 days after sanction" },
];

function getJourneyStep(stage: string): number {
  const map: Record<string, number> = {
    submitted: 0, under_initial_review: 1, documents_pending: 1,
    documents_under_review: 1, bre_evaluated: 2, sent_to_lender: 3,
    login_submitted: 3, credit_query: 4, sanction_received: 5,
    disbursed: 6, rejected: -1, dropped: -1, on_hold: -1,
  };
  return map[stage] ?? 0;
}

interface TrackerData {
  lead_summary: {
    id: string; lead_id: string; current_stage: string; current_status: string;
    student_stage_label: string; updated_at: string; created_at: string;
    student_first_name: string; intended_study_country: string;
    course_name: string; university_name_raw: string; loan_amount_required: number;
  };
  health: "on_track" | "needs_attention" | "action_required";
  current_focus: string;
  lender: { top_lender: { name: string; fit_label: string; processing_time_days: number | null } | null; total_matches: number; phase: string };
  documents: { total: number; pending: number; uploaded: number; under_review: number; verified: number; action_needed: number; not_required: number };
  timeline: { id: string; stage: string; stage_label: string; note: string | null; date: string }[];
}

export default function StudentTracker() {
  const navigate = useNavigate();
  const { isVerified, phone, leads, refreshLeads } = useStudentAuth();
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);

  const activeLead = leads.length > 0 ? leads[0] : null;

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
    if (!activeLead || !phone) { setLoading(false); return; }

    console.log("student.tracker.viewed");
    supabase.functions.invoke("student-application", {
      body: { action: "load_tracker", phone, lead_id: activeLead.id },
    }).then(({ data: res, error: err }) => {
      if (err || res?.error) { setError(res?.error || "Failed to load tracker"); }
      else { setData(res); }
      setLoading(false);
    });
  }, [isVerified, phone, activeLead?.id]);

  // Soft transitional retry — when context has no lead yet (e.g. just submitted),
  // refresh leads once before giving up. Avoids the abrupt "No Application Found".
  useEffect(() => {
    if (!isVerified || !phone) return;
    if (activeLead || retried) return;
    setRetried(true);
    setLoading(true);
    refreshLeads().finally(() => setLoading(false));
  }, [isVerified, phone, activeLead, retried, refreshLeads]);

  if (!isVerified) return null;

  // Transitional / fallback state — no lead in context yet.
  if (!loading && !activeLead) {
    // We've already attempted a refresh. Send the user back to Continue gracefully.
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
        <StudentHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
            <h2 className="text-lg font-semibold">Preparing your application…</h2>
            <p className="mt-2 text-sm text-muted-foreground">Thanks for your details. We're getting your tracker ready.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="outline" onClick={() => { setRetried(false); }}>Refresh</Button>
              <Button onClick={() => navigate("/student/continue")}>Go to Application</Button>
            </div>
          </CardContent></Card>
        </main>
        <StudentFooter />
      </div>
    );
  }

  const journeyStep = data ? getJourneyStep(data.lead_summary.current_stage) : 0;
  const isSpecialState = journeyStep === -1;

  // --- Health indicator ---
  const healthConfig = {
    on_track: { label: "On Track", icon: CircleCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800", micro: data?.lead_summary.current_stage === "disbursed" ? "🎉 Your loan has been disbursed — congratulations!" : data?.lead_summary.current_stage === "sanction_received" ? "🎉 Your loan has been approved! Disbursal is being processed." : "Everything looks good — no action needed from your side right now." },
    needs_attention: { label: "Needs Attention", icon: CircleAlert, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800", micro: "Some documents still need to be uploaded to keep your application moving." },
    action_required: { label: "Action Required", icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", micro: "Please address the highlighted items so your case can proceed." },
  };

  // --- Next step guidance ---
  function getGuidance(d: TrackerData) {
    const stage = d.lead_summary.current_stage;
    if (d.documents.action_needed > 0) return { text: `Re-upload ${d.documents.action_needed} document${d.documents.action_needed > 1 ? "s" : ""} that need${d.documents.action_needed === 1 ? "s" : ""} correction`, cta: "Resolve Blocking Documents", path: "/student/documents", icon: Upload, variant: "destructive" as const };
    if (d.documents.pending > 0) return { text: `Upload ${d.documents.pending} pending document${d.documents.pending > 1 ? "s" : ""} to move your case forward`, cta: "Upload Documents", path: "/student/documents", icon: Upload, variant: "default" as const };
    if (["submitted", "under_initial_review"].includes(stage)) return { text: "We're reviewing your application — no action needed right now", cta: null, path: null, icon: Clock, variant: "default" as const };
    if (["documents_under_review"].includes(stage)) return { text: "Your documents are under review. We'll update you on the next step.", cta: null, path: null, icon: Eye, variant: "default" as const };
    if (["bre_evaluated"].includes(stage)) return { text: "We're matching your profile with suitable lenders", cta: d.lender.total_matches > 0 ? "View Loan Options" : null, path: d.lender.total_matches > 0 ? "/student/recommendations" : null, icon: TrendingUp, variant: "default" as const };
    if (["sent_to_lender", "login_submitted"].includes(stage)) return { text: "Your application is being processed by the lender", cta: null, path: null, icon: Building2, variant: "default" as const };
    if (stage === "credit_query") return { text: "A query has been raised — please keep your phone available for follow-up", cta: null, path: null, icon: Phone, variant: "default" as const };
    if (stage === "sanction_received") return { text: "🎉 Great news — your loan has been approved! Disbursal will follow shortly.", cta: null, path: null, icon: CircleCheck, variant: "default" as const };
    if (stage === "disbursed") return { text: "🎉 Your loan has been disbursed! Congratulations on starting your journey.", cta: null, path: null, icon: CircleCheck, variant: "default" as const };
    return { text: "We're working on your application. Check back soon for updates.", cta: null, path: null, icon: Clock, variant: "default" as const };
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
      <StudentHeader />
      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">

          {loading ? <TrackerSkeleton /> : error ? (
            <Card><CardContent className="p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            </CardContent></Card>
          ) : data && (
            <>
              {/* A. Case Header */}
              <Card className="shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{data.lead_summary.lead_id || "—"}</span>
                        <HealthBadge health={data.health} />
                      </div>
                      <h1 className="text-xl font-bold text-foreground">{data.lead_summary.student_stage_label}</h1>
                      <p className="mt-1 text-sm text-muted-foreground">{healthConfig[data.health].micro}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Last updated</p>
                      <p className="text-sm font-medium">{formatDistanceToNow(new Date(data.lead_summary.updated_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                  {/* Case context strip */}
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                    {data.lead_summary.intended_study_country && <span>{data.lead_summary.intended_study_country}</span>}
                    {data.lead_summary.course_name && data.lead_summary.course_name !== "Not specified" && <span>· {data.lead_summary.course_name}</span>}
                    {data.lead_summary.university_name_raw && <span>· {data.lead_summary.university_name_raw}</span>}
                    {data.lead_summary.loan_amount_required && <span>· {formatINRWithUnit(data.lead_summary.loan_amount_required)}</span>}
                  </div>
                  {/* Case ownership */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Handled by the EduLoans team · Your dedicated case team is reviewing your profile</span>
                  </div>
                </CardContent>
              </Card>

              {/* A2. Current Focus */}
              <Card className={`shadow-sm border-l-4 ${data.health === "action_required" ? "border-l-destructive bg-destructive/[0.02]" : data.health === "needs_attention" ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10" : "border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10"}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  {data.health === "action_required" ? <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /> :
                   data.health === "needs_attention" ? <CircleAlert className="h-5 w-5 text-amber-600 shrink-0" /> :
                   <CircleCheck className="h-5 w-5 text-emerald-600 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Focus</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{data.current_focus}</p>
                  </div>
                </CardContent>
              </Card>

              {/* B. Journey Tracker */}
              <Card className="shadow-sm">
                <CardContent className="p-5 sm:p-6">
                  <h2 className="mb-4 text-base font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Application Journey
                  </h2>
                  <div className="flex flex-col gap-0">
                    {JOURNEY_STEPS.map((step, i) => {
                      const completed = !isSpecialState && i < journeyStep;
                      const current = !isSpecialState && i === journeyStep;
                      const future = isSpecialState || i > journeyStep;
                      return (
                        <div key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
                          {i < JOURNEY_STEPS.length - 1 && (
                            <div className={`absolute left-[15px] top-9 h-[calc(100%-1.25rem)] w-px ${completed ? "bg-emerald-400" : current ? "bg-primary/40" : "bg-border"}`} />
                          )}
                          <div className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            completed ? "border-emerald-500 bg-emerald-500 text-white" :
                            current ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" :
                            "border-muted-foreground/25 bg-muted text-muted-foreground/40"
                          }`}>
                            {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : current ? <CircleDot className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                          </div>
                          <div className={`pt-0.5 min-w-0 ${future ? "opacity-40" : ""}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${current ? "text-primary" : completed ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                              {current && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">Current</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                            {(current || (future && step.timeGuide)) && step.timeGuide && (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {step.timeGuide}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isSpecialState && (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800">
                      <AlertTriangle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                      {data.lead_summary.current_stage === "on_hold" ? "Your application is currently on hold. Our team will reach out with next steps." :
                       data.lead_summary.current_stage === "rejected" ? "Your application is under further review. Our team will guide you on available options." :
                       "Your application status has been updated. Please check back or contact support."}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* C. Next-Step Guidance */}
              {(() => {
                const g = getGuidance(data);
                return (
                  <Card className={`shadow-sm border-l-4 ${data.health === "action_required" ? "border-l-destructive" : data.health === "needs_attention" ? "border-l-amber-500" : "border-l-emerald-500"}`}>
                    <CardContent className="p-5 flex items-start gap-3">
                      <g.icon className={`h-5 w-5 shrink-0 mt-0.5 ${data.health === "action_required" ? "text-destructive" : data.health === "needs_attention" ? "text-amber-600" : "text-emerald-600"}`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">What to do next</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{g.text}</p>
                        {g.cta && g.path && (
                          <Button size="sm" className="mt-3 gap-1.5" onClick={() => navigate(g.path!)}>
                            {g.cta} <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* D. Active Lender */}
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Lender Status
                  </h2>
                  {data.lender.top_lender ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{data.lender.top_lender.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{data.lender.top_lender.fit_label}</Badge>
                          {data.lender.top_lender.processing_time_days && (
                            <span className="text-xs text-muted-foreground">~{data.lender.top_lender.processing_time_days} day processing</span>
                          )}
                        </div>
                        {data.lender.total_matches > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">{data.lender.total_matches - 1} more option{data.lender.total_matches - 1 > 1 ? "s" : ""} available</p>
                        )}
                        {/* Lender phase messaging */}
                        <p className="text-xs mt-1.5 flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {data.lender.phase === "processing" ? (
                            <span className="text-primary font-medium">Actively being processed — application forwarded to lender</span>
                          ) : data.lender.phase === "query_in_progress" ? (
                            <span className="text-amber-600 font-medium">Query in progress — lender has raised a question</span>
                          ) : data.lender.phase === "approved" ? (
                            <span className="text-emerald-600 font-medium">Approved by lender — sanction received</span>
                          ) : data.lender.phase === "disbursed" ? (
                            <span className="text-emerald-600 font-medium">Funds released by lender</span>
                          ) : (
                            <span className="text-muted-foreground">Recommended based on your profile — not yet in active processing</span>
                          )}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => navigate("/student/recommendations")}>
                        View Options <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <TrendingUp className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Lender matching is in progress</p>
                      <p className="text-xs text-muted-foreground mt-0.5">We're evaluating the best options for your profile. Options will appear here once available.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* E. Document Summary */}
              <Card className={`shadow-sm ${data.documents.action_needed > 0 ? "border-destructive/30" : data.documents.pending > 0 ? "border-amber-300" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Documents
                    </h2>
                    <Button size="sm" variant={data.documents.action_needed > 0 ? "destructive" : data.documents.pending > 0 ? "default" : "ghost"} className="gap-1 text-xs h-7" onClick={() => navigate("/student/documents")}>
                      {data.documents.action_needed > 0 ? "Resolve Issues" : data.documents.pending > 0 ? "Upload Now" : "View All"} <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  {data.documents.total === 0 ? (
                    <div className="text-center py-3">
                      <FileText className="mx-auto h-6 w-6 text-muted-foreground/40 mb-1.5" />
                      <p className="text-sm text-muted-foreground">No documents assigned yet</p>
                      <p className="text-xs text-muted-foreground">Requirements will appear as your case progresses</p>
                    </div>
                  ) : (
                    <>
                      {/* Blocking vs non-blocking distinction */}
                      {data.documents.action_needed > 0 && (
                        <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2.5 mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          <span className="text-xs text-destructive font-medium">{data.documents.action_needed} document{data.documents.action_needed > 1 ? "s" : ""} need{data.documents.action_needed === 1 ? "s" : ""} re-upload — this is blocking your case</span>
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: "Pending", val: data.documents.pending, color: data.documents.pending > 0 ? "text-amber-600 font-bold" : "text-muted-foreground" },
                          { label: "Uploaded", val: data.documents.uploaded + data.documents.under_review, color: "text-blue-600" },
                          { label: "Verified", val: data.documents.verified, color: "text-emerald-600" },
                          { label: "Action", val: data.documents.action_needed, color: data.documents.action_needed > 0 ? "text-destructive font-bold" : "text-muted-foreground" },
                        ].map(d => (
                          <div key={d.label} className="rounded-md border p-2">
                            <p className={`text-lg font-semibold ${d.color}`}>{d.val}</p>
                            <p className="text-[10px] text-muted-foreground">{d.label}</p>
                          </div>
                        ))}
                      </div>
                      {data.documents.action_needed === 0 && data.documents.pending === 0 && (
                        <p className="mt-2.5 text-xs text-emerald-600 flex items-center gap-1">
                          <CircleCheck className="h-3.5 w-3.5" /> All documents are on track — no action needed
                        </p>
                      )}
                      {data.documents.pending > 0 && data.documents.action_needed === 0 && (
                        <Button size="sm" className="mt-3 w-full gap-1.5" onClick={() => navigate("/student/documents")}>
                          <Upload className="h-3.5 w-3.5" /> Upload {data.documents.pending} Pending Document{data.documents.pending > 1 ? "s" : ""}
                        </Button>
                      )}
                      {data.documents.action_needed > 0 && (
                        <Button size="sm" className="mt-3 w-full gap-1.5" variant="destructive" onClick={() => navigate("/student/documents")}>
                          <AlertTriangle className="h-3.5 w-3.5" /> Resolve {data.documents.action_needed} Blocking Document{data.documents.action_needed > 1 ? "s" : ""}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* F. Recent Activity Timeline */}
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Recent Activity
                  </h2>
                  {data.timeline.length === 0 ? (
                    <div className="text-center py-3">
                      <Clock className="mx-auto h-6 w-6 text-muted-foreground/40 mb-1.5" />
                      <p className="text-sm text-muted-foreground">Your application has been submitted</p>
                      <p className="text-xs text-muted-foreground">Activity will appear here as your case progresses</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {data.timeline.slice(0, 10).map((event, i) => (
                        <div key={event.id} className={`flex gap-3 py-2.5 ${i < data.timeline.length - 1 ? "border-b border-border/50" : ""}`}>
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${i === 0 ? "bg-primary ring-2 ring-primary/20" : "bg-muted-foreground/30"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm ${i === 0 ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>{event.stage_label}</span>
                              <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(event.date), "dd MMM, h:mm a")}</span>
                            </div>
                            {event.note && <p className="text-xs text-muted-foreground mt-0.5">{event.note}</p>}
                            {i === 0 && <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0 border-primary/30 text-primary">Latest</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* G. Quick Actions */}
              <div className="grid gap-3 sm:grid-cols-3">
                {data.lender.total_matches > 0 && (
                  <Button variant="outline" className="gap-2 justify-start h-auto py-3" onClick={() => navigate("/student/recommendations")}>
                    <Building2 className="h-4 w-4 text-primary" />
                    <div className="text-left"><p className="text-sm font-medium">Loan Options</p><p className="text-[10px] text-muted-foreground">{data.lender.total_matches} lender{data.lender.total_matches > 1 ? "s" : ""} matched</p></div>
                  </Button>
                )}
                <Button variant="outline" className="gap-2 justify-start h-auto py-3" onClick={() => navigate("/student/documents")}>
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="text-left"><p className="text-sm font-medium">Documents</p><p className="text-[10px] text-muted-foreground">{data.documents.verified}/{data.documents.total} verified</p></div>
                </Button>
                <Button variant="outline" className="gap-2 justify-start h-auto py-3" onClick={() => navigate("/student/apply/review?view=submitted")}>
                  <Eye className="h-4 w-4 text-primary" />
                  <div className="text-left"><p className="text-sm font-medium">View Application</p><p className="text-[10px] text-muted-foreground">Review submitted details</p></div>
                </Button>
              </div>

              {/* H. Support */}
              <Card className="shadow-sm bg-muted/30">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Need help with your application?</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Our team is available to guide you through every step. Don't hesitate to reach out.</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { console.log("student.support.clicked"); window.location.href = "mailto:support@eduloans.com"; }}>
                          <Mail className="h-3 w-3" /> Email Support
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { console.log("student.support.clicked"); window.location.href = "tel:+911234567890"; }}>
                          <Phone className="h-3 w-3" /> Call Support
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trust strip */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Compass, title: "Guided Support", desc: "Expert guidance through every step" },
                  { icon: Building2, title: "Multi-Lender Access", desc: "Compare options in one journey" },
                  { icon: Eye, title: "Real-Time Visibility", desc: "Track your case progress anytime" },
                ].map(c => (
                  <div key={c.title} className="rounded-xl border bg-card p-4 text-center shadow-sm">
                    <c.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                    <h3 className="text-xs font-semibold text-foreground">{c.title}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <StudentFooter />
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const cfg = {
    on_track: { label: "On Track", cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400" },
    needs_attention: { label: "Needs Attention", cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400" },
    action_required: { label: "Action Required", cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400" },
  }[health] || { label: "In Progress", cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[10px] px-2 py-0 ${cfg.cls}`}>{cfg.label}</Badge>;
}

function TrackerSkeleton() {
  return (
    <div className="space-y-5">
      <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
      <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
      <Card><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
      <Card><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
    </div>
  );
}
