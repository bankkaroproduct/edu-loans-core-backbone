import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PillStep {
  id: string;
  label: string;
}

interface PillStepperProps {
  steps: PillStep[];
  activeId: string;
  onStepClick?: (id: string) => void;
  className?: string;
}

/**
 * Pill stepper for the Add Lead form (visual variant of the shared
 * HorizontalStepper). Uses the `.add-lead-shell` scope tokens.
 *
 * State machine is owned by the parent: it passes `activeId` and reacts
 * to `onStepClick`. This component has no internal state.
 */
export function PillStepper({ steps, activeId, onStepClick, className }: PillStepperProps) {
  const activeIdx = Math.max(0, steps.findIndex((s) => s.id === activeId));

  return (
    <div
      className={cn(
        "flex w-full items-center gap-0.5 overflow-x-auto rounded-full border bg-[color:var(--al-bg-card)] p-[5px]",
        "border-[color:var(--al-border-1)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
      aria-label="Form steps"
    >
      {steps.map((step, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "step" : undefined}
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              "group flex flex-1 min-w-fit items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--al-blue)] focus-visible:ring-offset-1",
              isActive && "bg-[color:var(--al-blue)] text-white",
              !isActive && "text-[color:var(--al-fg-2)] hover:text-[color:var(--al-fg-1)]",
              onStepClick ? "cursor-pointer" : "cursor-default",
            )}
          >
            <span
              className={cn(
                "al-tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                isActive && "bg-white/20 text-white",
                isDone && "bg-[color:var(--al-success-tint)] text-[color:var(--al-success)]",
                !isActive && !isDone && "bg-[color:var(--al-border-2)] text-[color:var(--al-fg-2)]",
              )}
            >
              {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className="text-[12.5px] font-bold tracking-[-0.005em]"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
