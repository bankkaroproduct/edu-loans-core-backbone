import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, LogOut, Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  currentStep: number; // 0-indexed: 0=basic, 1=education, 2=coapplicant, 3=review
  totalSteps?: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue?: () => void;
  onSaveExit?: () => void;
  saving?: boolean;
  continueLabel?: string;
  continueDisabled?: boolean;
  hideContinue?: boolean;
}

const STEP_LABELS = ["Basic Details", "Education Details", "Co-applicant", "Review & Submit"];

export function StudentStepLayout({
  children, currentStep, totalSteps = 4, title, subtitle,
  onBack, onContinue, onSaveExit, saving, continueLabel, continueDisabled, hideContinue,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
      <StudentHeader />

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {/* Progress header */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Step {currentStep + 1} of {totalSteps}</span>
              <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}% complete</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            {/* Step labels */}
            <div className="mt-3 hidden gap-1.5 sm:flex">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className={`flex-1 text-center text-[10px] font-medium ${
                  i === currentStep ? "text-primary" : i < currentStep ? "text-muted-foreground" : "text-muted-foreground/50"
                }`}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {/* Form content */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {onBack && (
                <Button variant="outline" onClick={onBack} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              {onSaveExit && (
                <Button variant="ghost" onClick={onSaveExit} disabled={saving} className="gap-1.5 text-muted-foreground">
                  <LogOut className="h-4 w-4" /> Save & Exit
                </Button>
              )}
            </div>
            {!hideContinue && onContinue && (
              <Button onClick={onContinue} disabled={continueDisabled || saving} size="lg" className="gap-2 sm:min-w-[180px]">
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <>{continueLabel || "Continue"} <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>

      <StudentFooter />
    </div>
  );
}
