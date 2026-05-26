import { Wallet, Clock, CheckCircle2, PiggyBank, ArrowRight, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { formatINR } from "@/lib/formatCurrency";

export interface PayoutSummary {
  totalAccrued: number;
  pending: number;
  approved: number;
  paid: number;
  reversed: number;
  recentRecords: {
    id: string;
    leadId: string;
    amount: number | null;
    status: string;
    updatedAt: string;
  }[];
}

interface CardSpec {
  key: string;
  label: string;
  sub: string;
  value: number;
  route: string;
  Icon: typeof Wallet;
  iconBg: string;
  iconFg: string;
  cardBg?: string;
  cardBorder?: string;
}

export function PayoutSnapshot({ data, loading }: { data: PayoutSummary; loading: boolean }) {
  const navigate = useNavigate();

  const cards: CardSpec[] = [
    {
      key: "total_earned",
      label: "Total Earned",
      sub: "Across all loans",
      value: data.totalAccrued,
      route: "/payouts",
      Icon: Wallet,
      iconBg: "#F1F3F6",
      iconFg: "var(--pp-fg-2)",
    },
    {
      key: "coming_soon",
      label: "Coming Soon",
      sub: "Pending milestones",
      value: data.pending,
      route: "/payouts?status=pending",
      Icon: Clock,
      iconBg: "var(--pp-warning-tint)",
      iconFg: "#B5870F",
      cardBg: "#FFFBEC",
      cardBorder: "#FAE9B3",
    },
    {
      key: "approved",
      label: "Approved",
      sub: "Cleared for payout",
      value: data.approved,
      route: "/payouts?status=approved",
      Icon: CheckCircle2,
      iconBg: "#EEF2FF",
      iconFg: "var(--pp-blue)",
    },
    {
      key: "received",
      label: "Received",
      sub: "Credited to account",
      value: data.paid,
      route: "/payouts?status=paid",
      Icon: PiggyBank,
      iconBg: "var(--pp-success-tint)",
      iconFg: "var(--pp-success)",
      cardBg: "#F2FBF6",
      cardBorder: "#C7EAD5",
    },
  ];

  const showReversed = data.reversed > 0;

  return (
    <section
      className="rounded-[12px] border bg-white"
      style={{ borderColor: "var(--pp-border-1)" }}
    >
      <header
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--pp-border-2)" }}
      >
        <div>
          <h3
            className="text-[16px] font-extrabold"
            style={{ letterSpacing: "-0.015em", color: "var(--pp-fg-1)" }}
          >
            Payout Summary
          </h3>
          <p className="text-[11.5px] font-medium" style={{ color: "var(--pp-fg-3)" }}>
            Earnings across the funnel
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/payouts")}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold"
          style={{ color: "var(--pp-blue)" }}
        >
          View Details
          <ArrowRight className="h-4 w-4" />
        </button>
      </header>

      <div className="p-5">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="grid gap-[14px] grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => navigate(c.route)}
                  className="flex flex-col items-center text-center gap-1 px-[18px] py-4 rounded-[10px] border transition-colors hover:brightness-[0.99]"
                  style={{
                    background: c.cardBg ?? "#fff",
                    borderColor: c.cardBorder ?? "var(--pp-border-1)",
                  }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-[7px]"
                    style={{ background: c.iconBg, color: c.iconFg }}
                  >
                    <c.Icon className="h-4 w-4" />
                  </span>
                  <p
                    className="text-[24px] font-extrabold tabular-nums mt-1"
                    style={{ letterSpacing: "-0.02em", color: "var(--pp-fg-1)" }}
                  >
                    {formatINR(c.value)}
                  </p>
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: "var(--pp-fg-2)" }}
                  >
                    {c.label}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--pp-fg-3)" }}
                  >
                    {c.sub}
                  </p>
                </button>
              ))}
            </div>

            {showReversed && (
              <button
                type="button"
                onClick={() => navigate("/payouts?status=reversed")}
                className="mt-3 flex items-center gap-2 text-[12px] font-medium"
                style={{ color: "var(--pp-error)" }}
              >
                <AlertTriangle className="h-4 w-4" />
                Reversed: {formatINR(data.reversed)}
              </button>
            )}

            {data.recentRecords.length > 0 && (
              <div className="mt-5 space-y-1.5">
                <p
                  className="text-[10.5px] font-bold uppercase"
                  style={{ letterSpacing: "0.08em", color: "var(--pp-fg-3)" }}
                >
                  Recent Records
                </p>
                {data.recentRecords.slice(0, 3).map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => navigate(`/payouts?lead=${r.leadId}`)}
                    className="w-full flex items-center justify-between text-[12.5px] px-3 py-2 rounded-[8px] border transition-colors hover:bg-[#FAFBFC]"
                    style={{ borderColor: "var(--pp-border-2)" }}
                  >
                    <span className="font-mono" style={{ color: "var(--pp-fg-3)" }}>
                      {r.leadId.slice(0, 8)}…
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--pp-fg-1)" }}>
                      {r.amount ? formatINR(r.amount) : "—"}
                    </span>
                    <span className="capitalize" style={{ color: "var(--pp-fg-2)" }}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
