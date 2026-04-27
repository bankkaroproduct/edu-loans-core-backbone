import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  /** Stable id consumed by the parent state machine. */
  id: string;
  /** Visible label. */
  label: string;
}

interface HorizontalStepperProps {
  steps: StepperStep[];
  /** Currently active step id. */
  activeId: string;
  /** Click handler — parent decides whether to allow the jump. */
  onStepClick?: (id: string) => void;
  className?: string;
}

/**
 * Visual horizontal stepper for multi-step forms.
 *
 * Renders: [① Label] ───── [② Label] ───── [③ Label]
 *   - Completed: emerald ring + check icon
 *   - Active:    primary ring + filled bg + medium label
 *   - Future:    muted ring + number
 *
 * Pure visual swap for a tab strip. Does not own state; the parent
 * controls activeId and reacts to onStepClick. State-machine free.
 */
export function HorizontalStepper({
  steps,
  activeId,
  onStepClick,
  className,
}: HorizontalStepperProps) {
  const activeIdx = Math.max(
    0,
    steps.findIndex((s) => s.id === activeId),
  );

  return (
    <ol
      className={cn(
        "flex items-center w-full gap-0 overflow-x-auto pb-1",
        className,
      )}
      aria-label="Form steps"
    >
      {steps.map((step, i) => {
        const isActive = i === activeIdx;
        const isCompleted = i < activeIdx;
        const isLast = i === steps.length - 1;

        return (
          <li
            key={step.id}
            className="flex items-center flex-1 min-w-fit last:flex-none"
          >
            <button
              type="button"
              onClick={() => onStepClick?.(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "group flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                onStepClick ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                  isCompleted &&
                    "border-emerald-500 bg-emerald-500 text-white",
                  isActive &&
                    !isCompleted &&
                    "border-primary bg-primary text-primary-foreground",
                  !isActive &&
                    !isCompleted &&
                    "border-border bg-background text-muted-foreground group-hover:border-muted-foreground/40",
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {step.label}
              </span>
            </button>

            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 h-px flex-1 min-w-[16px] transition-colors",
                  i < activeIdx ? "bg-emerald-500/60" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
