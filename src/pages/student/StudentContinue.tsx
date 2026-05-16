import { useNavigate } from "react-router-dom";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { supabase } from "@/integrations/supabase/client";
import { deriveStepCompletion, deriveCurrentStep } from "@/hooks/useStudentApplication";
import { useEffect, useState } from "react";
import {
  CheckCircle2, ArrowRight, Shield, Compass, HeartHandshake,
  FileText, GraduationCap, Users, ClipboardCheck, Clock,
  Upload, Building2, Eye, Loader2, PartyPopper
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const APPLICATION_STEPS = [
  { key: "basic", label: "Basic Details", icon: FileText, desc: "Name, contact, and residence", path: "/student/apply/basic" },
  { key: "education", label: "Education Details", icon: GraduationCap, desc: "Course, university, and intake", path: "/student/apply/education" },
  { key: "coapplicant", label: "Co-applicant", icon: Users, desc: "Guardian or co-applicant info", path: "/student/apply/coapplicant" },
  { key: "review", label: "Review & Submit", icon: ClipboardCheck, desc: "Review and submit your application", path: "/student/apply/review" },
];

interface PostSubmitState {
  loading: boolean;
  hasRecommendations: boolean;
  docActionNeeded: number;
  recommendationCount: number;
  stage: string;
}

export default function StudentContinue() {
  const navigate = useNavigate();
  const { isVerified, leads, studentName, phone } = useStudentAuth();
  const [postSubmit, setPostSubmit] = useState<PostSubmitState>({ loading: false, hasRecommendations: false, docActionNeeded: 0, recommendationCount: 0, stage: "" });

  useEffect(() => {
    if (!isVerified) {
      navigate("/student/login");
    }
  }, [isVerified, navigate]);

  const activeLead = leads.length > 0 ? leads[0] : null;
  const completion = deriveStepCompletion(activeLead);
  const isSubmitted = completion.submitted;

  // Auto-redirect submitted students to tracker
  useEffect(() => {
    if (isSubmitted && activeLead) {
      navigate("/student/tracker", { replace: true });
    }
  }, [isSubmitted, activeLead, navigate]);

  if (!isVerified || isSubmitted) return null;

  const progress = deriveCurrentStep(completion);
  const currentStepIndex = Math.min(progress, APPLICATION_STEPS.length - 1);
  const isNew = !activeLead;
  const displayName = studentName || "there";
  const lastUpdated = activeLead?.updated_at
    ? formatDistanceToNow(new Date(activeLead.updated_at), { addSuffix: true })
    : null;

  const getTargetPath = () => {
    if (completion.coapplicant) return "/student/apply/review";
    if (completion.education) return "/student/apply/coapplicant";
    if (completion.basic) return "/student/apply/education";
    return "/student/apply/basic";
  };
  const targetPath = getTargetPath();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
      <StudentHeader />

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">

          {/* Welcome header */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Welcome{isNew ? "" : " back"}, {displayName}!
              </h1>
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="mt-1.5 text-muted-foreground">
              {isNew
                ? "You're verified! Let's start your education loan application."
                : "Your identity is verified. Continue your application below."}
            </p>
          </div>

          {/* Progress container */}
          <Card className="mb-6 shadow-md">
            <CardContent className="p-5 sm:p-8">
              <h2 className="mb-5 text-lg font-semibold text-foreground">Application Progress</h2>
              <div className="flex flex-col gap-0">
                {APPLICATION_STEPS.map((step, i) => {
                  const completed = i < progress;
                  const current = i === progress && progress < APPLICATION_STEPS.length;
                  const future = i > progress;
                  return (
                    <div key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < APPLICATION_STEPS.length - 1 && (
                        <div className={`absolute left-[18px] top-10 h-[calc(100%-1.5rem)] w-px ${completed ? "bg-emerald-400" : "bg-border"}`} />
                      )}
                      <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        completed ? "border-emerald-500 bg-emerald-500 text-white" :
                        current ? "border-primary bg-primary/10 text-primary" :
                        "border-muted-foreground/30 bg-muted text-muted-foreground/50"
                      }`}>
                        {completed ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                      </div>
                      <div className={`pt-0.5 ${future ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold ${current ? "text-primary" : "text-foreground"}`}>{step.label}</h3>
                          {completed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Done</span>}
                          {current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Current</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                        {current && (
                          <p className="mt-1 text-xs font-medium text-primary">
                            {isNew ? "Start by filling in your basic details" : "Complete this step to move forward"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pre-submit CTA */}
              <div className="mt-6">
                <Button size="lg" className="w-full gap-2 text-base" onClick={() => navigate(targetPath)}>
                  {isNew ? "Start Application" : "Continue Application"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Last / Next step cards */}
          {!isNew && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-semibold">Last Completed</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {progress > 0 ? APPLICATION_STEPS[progress - 1].label : "None yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {progress > 0 ? APPLICATION_STEPS[progress - 1].desc : "Start your first step"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-sm font-semibold">Next Step</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {progress < APPLICATION_STEPS.length ? APPLICATION_STEPS[currentStepIndex].label : "All done!"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {progress < APPLICATION_STEPS.length ? APPLICATION_STEPS[currentStepIndex].desc : "Your application is complete"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reassurance cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Compass, title: "Guided Process", desc: "Clear instructions at every step" },
              { icon: Shield, title: "Secure Journey", desc: "Your data is encrypted and protected" },
              { icon: HeartHandshake, title: "Ongoing Support", desc: "Help is available whenever you need it" },
            ].map(c => (
              <div key={c.title} className="rounded-xl border bg-card p-4 text-center shadow-sm sm:p-5">
                <c.icon className="mx-auto mb-2 h-5 w-5 text-primary sm:h-6 sm:w-6" />
                <h3 className="text-xs font-semibold text-foreground sm:text-sm">{c.title}</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Save state message */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Progress saved automatically
              {lastUpdated && <> · Last updated {lastUpdated}</>}
            </span>
          </div>
        </div>
      </main>

      <StudentFooter />
    </div>
  );
}
