import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Shield, Compass,
  HeartHandshake, Building2, Star, ThumbsUp, Eye, RefreshCw,
  FileText, Search, Send, Award, Banknote, HelpCircle, Loader2, Globe, Zap,
  ArrowLeft, Mail, Phone, PartyPopper
} from "lucide-react";
import { INRAmountStacked } from "@/components/shared/INRAmountStacked";
import { buildBreProfileFromLead } from "@/lib/bre/leadProfile";
import { evaluate } from "@/lib/bre/engine";
import type { BreResult } from "@/lib/bre/types";
import { mapLenderCards, type LenderCard } from "@/components/student/recommendations/lenderCardModel";
import { LenderMatchCard } from "@/components/student/recommendations/LenderMatchCard";
import { MatchesPageChrome, type SortKey } from "@/components/student/recommendations/MatchesPageChrome";

interface Recommendation {
  id: string;
  lender_name: string;
  fit_category: string;
  fit_label: string;
  reason_summary: string | null;
  processing_time_days: number | null;
  why_bullets: string[];
}

interface LeadSummary {
  id: string;
  lead_id: string | null;
  intended_study_country: string;
  university_name_raw: string | null;
  course_name: string;
  loan_amount_required: number | null;
  intake_term: string;
  intake_year: number;
  coapplicant_name: string | null;
  current_stage: string;
}

type PageState = "loading" | "not_submitted" | "under_review" | "has_matches" | "no_matches" | "error";

const JOURNEY_STEPS = [
  { label: "Application Submitted", icon: CheckCircle2 },
  { label: "Review & Matching", icon: Search },
  { label: "Complete Documents", icon: FileText },
  { label: "Case Review", icon: Send },
  { label: "Approval & Sanction", icon: Award },
  { label: "Disbursal", icon: Banknote },
];

const FIT_COLORS: Record<string, { badge: string; border: string }> = {
  "Best Fit": { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", border: "border-emerald-200 bg-emerald-50/30" },
  "Top Match": { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", border: "border-emerald-200 bg-emerald-50/30" },
  "Good Fit": { badge: "bg-blue-100 text-blue-800 border-blue-200", border: "border-blue-200 bg-blue-50/30" },
  "Worth Considering": { badge: "bg-muted text-muted-foreground border-border", border: "border-border" },
  "Under Review": { badge: "bg-amber-100 text-amber-800 border-amber-200", border: "border-amber-200" },
};

// Positive stage check
const POSITIVE_STAGES = ["sanction_received", "disbursed"];

export default function StudentRecommendations() {
  const navigate = useNavigate();
  const { isVerified, phone, leads } = useStudentAuth();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [leadSummary, setLeadSummary] = useState<LeadSummary | null>(null);
  const [hasPendingDocs, setHasPendingDocs] = useState(false);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
    loadRecommendations();
  }, [isVerified]);

  const loadRecommendations = async () => {
    setPageState("loading");
    console.log("[student.recommendations.viewed]");
    try {
      const activeLead = leads[0];
      const { data, error } = await supabase.functions.invoke("student-application", {
        body: { action: "load_recommendations", phone, lead_id: activeLead?.id },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("not yet submitted")) { setPageState("not_submitted"); return; }
        throw new Error(data.error);
      }
      setLeadSummary(data.lead_summary);
      setRecommendations(data.recommendations || []);
      setHasPendingDocs(data.has_pending_docs);
      setPageState(data.recommendations?.length > 0 ? "has_matches" : (data.total_matches > 0 ? "no_matches" : "under_review"));
    } catch (err: any) {
      console.error("Load recommendations error:", err);
      setPageState("error");
    }
  };

  if (!isVerified) return null;

  const isPositiveStage = leadSummary && POSITIVE_STAGES.includes(leadSummary.current_stage);

  const currentJourneyStep = (() => {
    if (!leadSummary) return 1;
    const stage = leadSummary.current_stage;
    if (stage === "submitted" || stage === "under_initial_review") return 1;
    if (stage === "documents_pending" || stage === "documents_under_review") return 2;
    if (stage === "bre_evaluated" || stage === "sent_to_lender" || stage === "login_submitted") return 3;
    if (stage === "credit_query" || stage === "sanction_received") return 4;
    if (stage === "disbursed") return 5;
    return 1;
  })();

  const formatAmount = (amt: number | null): ReactNode => <INRAmountStacked value={amt} />;

  // State-aware card CTA
  const getCardCTA = () => {
    if (!hasPendingDocs) return { label: "View Tracker", path: "/student/tracker" };
    return { label: "Complete Documents", path: "/student/documents" };
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
      <StudentHeader />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl">

          {/* Back to tracker */}
          <button onClick={() => navigate("/student/tracker")} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Tracker
          </button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your Loan Options</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Based on your profile, here are your recommended lending partners. These may be refined as your application progresses.
            </p>
          </div>

          {/* Loading */}
          {pageState === "loading" && (
            <Card className="py-16 text-center">
              <CardContent>
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your recommendations…</p>
              </CardContent>
            </Card>
          )}

          {/* Not submitted */}
          {pageState === "not_submitted" && (
            <Card className="py-12 text-center">
              <CardContent>
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
                <h2 className="text-lg font-semibold">Application Not Yet Submitted</h2>
                <p className="mt-1 text-sm text-muted-foreground">Complete and submit your application to see lender recommendations.</p>
                <Button className="mt-4" onClick={() => navigate("/student/continue")}>Go to Application <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {pageState === "error" && (
            <Card className="py-12 text-center">
              <CardContent>
                <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="mt-1 text-sm text-muted-foreground">We couldn't load your recommendations right now. Please try again.</p>
                <Button variant="outline" className="mt-4" onClick={loadRecommendations}><RefreshCw className="mr-1 h-4 w-4" /> Try Again</Button>
                <p className="mt-3 text-xs text-muted-foreground">If this persists, contact <a href="mailto:support@eduloans.com" className="text-primary underline">support@eduloans.com</a></p>
              </CardContent>
            </Card>
          )}

          {/* Under Review — no matches yet */}
          {pageState === "under_review" && (
            <>
              {leadSummary && <SummaryStrip summary={leadSummary} formatAmount={formatAmount} />}
              <Card className="mb-6 border-amber-200 bg-amber-50/50 py-10 text-center">
                <CardContent>
                  <Clock className="mx-auto mb-3 h-8 w-8 text-amber-600" />
                  <h2 className="text-lg font-semibold text-amber-900">Your Profile is Under Review</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-amber-700">
                    Our team is evaluating your application to find the best lending partners for you. This typically takes 1–2 business days.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-xs text-amber-600">
                    No action needed from your side right now — we'll update you as soon as options are available.
                  </p>
                </CardContent>
              </Card>
              <JourneySteps currentStep={currentJourneyStep} />
              <TrustStrip />
              <SupportCTA />
            </>
          )}

          {/* No visible matches (all filtered) */}
          {pageState === "no_matches" && (
            <>
              {leadSummary && <SummaryStrip summary={leadSummary} formatAmount={formatAmount} />}
              <Card className="mb-6 border-blue-200 bg-blue-50/50 py-10 text-center">
                <CardContent>
                  <Search className="mx-auto mb-3 h-8 w-8 text-blue-600" />
                  <h2 className="text-lg font-semibold text-blue-900">We're Exploring Options for You</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-blue-700">
                    This doesn't mean you're ineligible — our team is reviewing your case for the best possible match. Completing your documents can help improve your options.
                  </p>
                  <Button className="mt-4" onClick={() => navigate("/student/documents")}>
                    Complete Documents <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
              <JourneySteps currentStep={currentJourneyStep} />
              <TrustStrip />
              <SupportCTA />
            </>
          )}

          {/* Has matches */}
          {pageState === "has_matches" && (
            <>
              {leadSummary && <SummaryStrip summary={leadSummary} formatAmount={formatAmount} />}

              {/* Positive state: approved/disbursed */}
              {isPositiveStage && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-800">
                      {leadSummary?.current_stage === "disbursed"
                        ? "Congratulations! Your loan has been disbursed. Below are the lenders who were part of your journey."
                        : "Great news — your loan has been approved! Disbursal will follow shortly."}
                    </p>
                  </div>
                </div>
              )}

              {/* Provisional notice */}
              {hasPendingDocs && !isPositiveStage && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      These options are based on your current profile. Final matching may improve once your documents are reviewed.
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendation cards */}
              <div className="mb-6 space-y-4">
                {recommendations.map((rec) => {
                  const colors = FIT_COLORS[rec.fit_label] || FIT_COLORS["Under Review"];
                  const cardCTA = getCardCTA();
                  return (
                    <Card key={rec.id} className={`overflow-hidden transition-shadow hover:shadow-md ${colors.border}`}>
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          <div className="flex-1 p-4 sm:p-6">
                            <div className="mb-3 flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-foreground">{rec.lender_name}</h3>
                                <Badge variant="outline" className={`mt-0.5 text-[10px] ${colors.badge}`}>
                                  {rec.fit_label}
                                </Badge>
                              </div>
                            </div>

                            {rec.reason_summary && (
                              <p className="mb-3 text-sm text-muted-foreground">{rec.reason_summary}</p>
                            )}

                            {/* Why this suits you */}
                            <div className="mb-3 rounded-lg bg-muted/50 p-3">
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why this suits you</p>
                              <ul className="space-y-1">
                                {rec.why_bullets.map((bullet, bi) => (
                                  <li key={bi} className="flex items-start gap-2 text-sm text-foreground">
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {rec.processing_time_days && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                Typical processing: {rec.processing_time_days} days
                              </div>
                            )}
                          </div>

                          <div className="flex items-center border-t p-4 sm:border-l sm:border-t-0 sm:p-6">
                            <Button
                              size="sm"
                              className="w-full gap-1.5 sm:w-auto"
                              onClick={() => {
                                console.log("[student.recommendation.card_clicked]", { lender: rec.lender_name });
                                navigate(cardCTA.path);
                              }}
                            >
                              {cardCTA.label} <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Why these options */}
              <Card className="mb-6">
                <CardContent className="p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Why These Options?</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { icon: Globe, text: "Your destination country and university" },
                      { icon: Star, text: "Your course and academic profile" },
                      { icon: ThumbsUp, text: "Co-applicant and financial context" },
                      { icon: FileText, text: "Application completeness" },
                    ].map(item => (
                      <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <item.icon className="h-4 w-4 shrink-0 text-primary" />
                        {item.text}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <JourneySteps currentStep={currentJourneyStep} />

              {/* Next step guidance */}
              <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardContent className="p-4 text-center sm:p-5">
                  {isPositiveStage ? (
                    <>
                      <PartyPopper className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                      <p className="text-sm font-medium text-foreground">
                        {leadSummary?.current_stage === "disbursed"
                          ? "Your loan journey is complete — congratulations!"
                          : "Your loan has been approved! Disbursal is being processed."}
                      </p>
                    </>
                  ) : hasPendingDocs ? (
                    <>
                      <FileText className="mx-auto mb-2 h-6 w-6 text-primary" />
                      <p className="text-sm font-medium text-foreground">Upload your required documents to move ahead</p>
                      <Button size="sm" className="mt-3" onClick={() => navigate("/student/documents")}>
                        Complete Documents <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                      <p className="text-sm font-medium text-foreground">Your application is progressing — we'll update you on next steps</p>
                      <p className="mt-1 text-xs text-muted-foreground">No action needed from your side right now.</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <TrustStrip />
              <SupportCTA />
            </>
          )}
        </div>
      </main>
      <StudentFooter />
    </div>
  );
}

function SummaryStrip({ summary, formatAmount }: { summary: LeadSummary; formatAmount: (a: number | null) => ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
      <span><strong className="text-foreground">{summary.intended_study_country}</strong></span>
      {summary.university_name_raw && <span>· {summary.university_name_raw}</span>}
      <span>· {summary.course_name}</span>
      <span className="inline-flex items-center gap-1">· {formatAmount(summary.loan_amount_required)}</span>
      <span>· {summary.intake_term} {summary.intake_year}</span>
      <span>· Co-applicant: {summary.coapplicant_name ? "Yes" : "No"}</span>
    </div>
  );
}

function JourneySteps({ currentStep }: { currentStep: number }) {
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">What Happens Next</h3>
        <div className="flex flex-col gap-0">
          {JOURNEY_STEPS.map((step, i) => {
            const done = i < currentStep;
            const current = i === currentStep;
            return (
              <div key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
                {i < JOURNEY_STEPS.length - 1 && (
                  <div className={`absolute left-[14px] top-8 h-[calc(100%-1rem)] w-px ${done ? "bg-emerald-400" : "bg-border"}`} />
                )}
                <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  done ? "border-emerald-500 bg-emerald-500 text-white" :
                  current ? "border-primary bg-primary/10 text-primary" :
                  "border-muted-foreground/30 bg-muted text-muted-foreground/40"
                }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <step.icon className="h-3.5 w-3.5" />}
                </div>
                <div className="pt-0.5">
                  <p className={`text-sm ${done ? "font-medium text-foreground" : current ? "font-semibold text-primary" : "text-muted-foreground/60"}`}>
                    {step.label}
                    {done && <span className="ml-2 text-[10px] font-normal text-emerald-600">✓</span>}
                    {current && <span className="ml-2 text-[10px] text-primary">← You are here</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TrustStrip() {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      {[
        { icon: Compass, title: "Guided Support", desc: "Expert guidance through every step" },
        { icon: Building2, title: "Multi-Lender Access", desc: "Compare options in one journey" },
        { icon: Eye, title: "Real-Time Visibility", desc: "Track your case progress anytime" },
      ].map(c => (
        <div key={c.title} className="rounded-xl border bg-card p-3 text-center shadow-sm sm:p-4">
          <c.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">{c.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}

function SupportCTA() {
  return (
    <div className="mb-4 text-center">
      <a
        href="mailto:support@eduloans.com"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        onClick={() => console.log("[student.support.clicked]", { page: "recommendations" })}
      >
        <HelpCircle className="h-4 w-4" /> Need help understanding your options?
      </a>
    </div>
  );
}
