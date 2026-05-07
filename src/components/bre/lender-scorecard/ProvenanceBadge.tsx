import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProvenanceTag } from "@/lib/bre/lenderScorecard/types";

const META: Record<ProvenanceTag, { label: string; cls: string; tip: string }> = {
  source_backed: {
    label: "Source-backed",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    tip: "Backed by lender source documentation.",
  },
  inferred: {
    label: "Inferred",
    cls: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
    tip: "Derived from related lender data; not directly sourced.",
  },
  proposed: {
    label: "Proposed",
    cls: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
    tip: "Default proposed value — not yet validated by business.",
  },
  needs_business_validation: {
    label: "Needs validation",
    cls: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
    tip: "Conflicting/uncertain source — pending business validation.",
  },
};

export function ProvenanceBadge({ tag, className }: { tag: ProvenanceTag; className?: string }) {
  const m = META[tag] ?? META.proposed;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${m.cls} ${className ?? ""}`}>{m.label}</Badge>
        </TooltipTrigger>
        <TooltipContent>{m.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
