import { Check, ListChecks, Lightbulb, History, BarChart3, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AddLeadPortal } from "./AddLeadHeader";

export interface CompletionStep {
  id: string;
  label: string;
  state: "pending" | "active" | "done";
}

interface RightRailProps {
  portal: AddLeadPortal;
  /** Steps for the completion card, in order. */
  steps: CompletionStep[];
  /** Whether we are on the Review step (drives "What happens next" advancement). */
  onReviewStep?: boolean;
}

const TIPS_BY_PORTAL: Record<AddLeadPortal, string[]> = {
  admin: [
    "Mobile must match WhatsApp for partner verification flow.",
    "Pincode auto-fills district & state — saves 2 fields per lead.",
    "Email is optional but required before lender push.",
  ],
  partner: [
    "Adding accurate destination & loan amount unlocks more lender matches.",
    "Pincode auto-fills district & state — saves 2 fields per lead.",
    "Commission credits 7 days after disbursal.",
  ],
  student: [
    "Keep your Aadhaar/Passport handy — name must match exactly.",
    "Pincode auto-fills district & state — saves 2 fields.",
    "You can save & resume anytime from your phone.",
  ],
};

export function RightRail({ portal, steps, onReviewStep }: RightRailProps) {
  return (
    <aside className="space-y-4">
      <CompletionCard steps={steps} />
      <div className="hidden md:block space-y-4">
        <QuickTipsCard tips={TIPS_BY_PORTAL[portal]} />
        {portal === "admin" && <RecentlyAddedCard />}
        {portal === "partner" && <ThisMonthCard />}
        {portal === "student" && <WhatHappensNextCard onReviewStep={!!onReviewStep} />}
      </div>
    </aside>
  );
}

/* ------------------------- Sub-cards ------------------------- */

function RailCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-[color:var(--al-border-1)] bg-[color:var(--al-bg-card)] p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function RailHeader({
  icon: Icon,
  label,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconColor?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", iconColor ?? "text-[color:var(--al-fg-3)]")} />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--al-fg-3)]">
        {label}
      </span>
    </div>
  );
}

function CompletionCard({ steps }: { steps: CompletionStep[] }) {
  return (
    <RailCard>
      <RailHeader icon={ListChecks} label="Completion" />
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5">
            <Bullet state={s.state} />
            <span
              className={cn(
                "flex-1 text-[12.5px] font-semibold",
                s.state === "pending"
                  ? "text-[color:var(--al-fg-3)]"
                  : "text-[color:var(--al-fg-1)]",
              )}
            >
              {s.label}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--al-fg-3)]">
              {s.state === "active" ? "In progress" : s.state === "done" ? "Complete" : "Pending"}
            </span>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

function Bullet({ state }: { state: CompletionStep["state"] }) {
  if (state === "done") {
    return (
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[color:var(--al-success-tint)]">
        <Check className="h-2.5 w-2.5 text-[color:var(--al-success)]" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[color:var(--al-blue)]">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </span>
    );
  }
  return <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-[color:var(--al-border-2)]" />;
}

function QuickTipsCard({ tips }: { tips: string[] }) {
  return (
    <RailCard>
      <RailHeader icon={Lightbulb} label="Quick tips" iconColor="text-[color:var(--al-orange)]" />
      <ul className="space-y-2">
        {tips.map((t, i) => (
          <li
            key={i}
            className="relative pl-[18px] text-[12px] font-medium leading-[17px] text-[color:var(--al-fg-1)]"
          >
            <span className="absolute left-0 top-[6px] h-1.5 w-1.5 rounded-full bg-[color:var(--al-orange)]" />
            {t}
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

function RecentlyAddedCard() {
  // TODO: wire recent leads from existing admin lead-queue store / session.
  return (
    <RailCard>
      <RailHeader icon={History} label="Recently added" />
      <p className="text-[12px] text-[color:var(--al-fg-3)]">
        Your recent admin-created leads will appear here.
      </p>
    </RailCard>
  );
}

function ThisMonthCard() {
  // TODO: wire partner metrics this month (sanctioned count, pending payout).
  return (
    <RailCard>
      <RailHeader icon={BarChart3} label="This month" />
      <div className="al-tabular text-[28px] font-extrabold leading-none text-[color:var(--al-fg-1)]">
        —
      </div>
      <div className="mt-1 text-[12px] font-semibold text-[color:var(--al-fg-3)]">
        leads added
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[color:var(--al-border-2)] pt-3">
        <div>
          <div className="al-tabular text-[15px] font-bold text-[color:var(--al-fg-1)]">—</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--al-fg-3)]">
            Sanctioned
          </div>
        </div>
        <div>
          <div className="al-tabular text-[15px] font-bold text-[color:var(--al-orange)]">—</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--al-fg-3)]">
            Pending payout
          </div>
        </div>
      </div>
    </RailCard>
  );
}

function WhatHappensNextCard({ onReviewStep }: { onReviewStep: boolean }) {
  // Row 1 done on Review; row 2 active on Review; else row 1 active.
  const rows: { title: string; sub: string; state: CompletionStep["state"] }[] = [
    {
      title: "Fill your details",
      sub: onReviewStep ? "Completed" : "In progress",
      state: onReviewStep ? "done" : "active",
    },
    {
      title: "Verify mobile (OTP)",
      sub: "~2 min",
      state: onReviewStep ? "active" : "pending",
    },
    { title: "See your lender matches", sub: "instantly", state: "pending" },
    { title: "Speak to a counsellor", sub: "on request", state: "pending" },
  ];
  return (
    <RailCard>
      <RailHeader icon={Route} label="What happens next" iconColor="text-[color:var(--al-blue)]" />
      <ol className="relative space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-2.5">
            <div className="relative flex flex-col items-center">
              <Bullet state={r.state} />
              {i < rows.length - 1 && (
                <span className="mt-1 h-5 w-[2px] flex-1 bg-[color:var(--al-border-2)]" />
              )}
            </div>
            <div className="pb-1">
              <div
                className={cn(
                  "text-[12.5px] font-semibold",
                  r.state === "pending"
                    ? "text-[color:var(--al-fg-3)]"
                    : "text-[color:var(--al-fg-1)]",
                )}
              >
                {r.title}
              </div>
              <div className="text-[11px] font-medium text-[color:var(--al-fg-3)]">{r.sub}</div>
            </div>
          </li>
        ))}
      </ol>
    </RailCard>
  );
}
