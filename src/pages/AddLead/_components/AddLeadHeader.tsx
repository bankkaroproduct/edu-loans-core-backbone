import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type AddLeadPortal = "admin" | "partner" | "student";

interface AddLeadHeaderProps {
  portal: AddLeadPortal;
  /** Custom title override (used when editing a draft / existing lead). */
  title?: string;
  /** Custom subtitle override. */
  subtitle?: string;
  onBack?: () => void;
  /** Right-side ghost action (Cancel / Save & exit). */
  onSecondaryAction?: () => void;
  /** Optional badge to show beside the title (DRAFT / EDIT). */
  modeBadge?: string;
  /** Draft autosave timestamp (e.g. "2m"). When provided, renders the Draft chip. */
  draftLabel?: string;
}

const DEFAULTS: Record<AddLeadPortal, { title: string; subtitle: string; cta: string }> = {
  admin: {
    title: "Add Lead",
    subtitle: "Create a lead on behalf of a partner organisation.",
    cta: "Cancel",
  },
  partner: {
    title: "Add Lead",
    subtitle: "Add a lead under your partner account — earns commission on approval.",
    cta: "Cancel",
  },
  student: {
    title: "Start your loan application",
    subtitle: "Tell us about yourself — we'll match you with the best loan offers.",
    cta: "Save & exit",
  },
};

export function AddLeadHeader({
  portal,
  title,
  subtitle,
  onBack,
  onSecondaryAction,
  modeBadge,
  draftLabel,
}: AddLeadHeaderProps) {
  const d = DEFAULTS[portal];
  return (
    <div className="flex items-start gap-3.5">
      {onBack && (
        <Button
          variant="outline"
          size="icon"
          onClick={onBack}
          aria-label="Back"
          className="h-8 w-8 shrink-0 rounded-full border-[color:var(--al-border-1)] bg-[color:var(--al-bg-card)] hover:border-[color:var(--al-blue)] hover:text-[color:var(--al-blue)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-[24px] font-extrabold leading-tight tracking-[-0.025em] text-[color:var(--al-fg-1)]">
          {title ?? d.title}
          {modeBadge && (
            <Badge variant="outline" className="ml-1 text-[10px] font-semibold uppercase">
              {modeBadge}
            </Badge>
          )}
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[color:var(--al-fg-2)]">
          {subtitle ?? d.subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {draftLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--al-border-2)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--al-fg-2)]">
            <Clock className="h-3 w-3" />
            Draft · {draftLabel}
          </span>
        )}
        {onSecondaryAction && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSecondaryAction}
            className="text-[color:var(--al-fg-1)] hover:bg-[color:var(--al-border-2)]"
          >
            {d.cta}
          </Button>
        )}
      </div>
    </div>
  );
}
