import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle } from "lucide-react";
import { useState } from "react";

const LEGEND = [
  { status: "Pending", desc: "Payout record created but not yet approved." },
  { status: "Triggered", desc: "Lead reached the payout milestone stage." },
  { status: "Approved", desc: "Payout approved and awaiting settlement." },
  { status: "Paid", desc: "Payout settled to partner." },
  { status: "On Hold", desc: "Payout temporarily paused for review." },
  { status: "Reversed", desc: "Previously recorded payout adjusted or clawed back." },
  { status: "Cancelled", desc: "Payout cancelled and will not be settled." },
];

export function PayoutStatusLegend() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <HelpCircle className="h-3.5 w-3.5" />
        {open ? "Hide" : "Show"} payout status guide
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs border rounded-lg p-3 bg-muted/30">
          {LEGEND.map((l) => (
            <div key={l.status}>
              <span className="font-medium">{l.status}:</span>{" "}
              <span className="text-muted-foreground">{l.desc}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
