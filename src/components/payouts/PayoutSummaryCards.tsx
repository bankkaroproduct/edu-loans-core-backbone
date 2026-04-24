import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, CreditCard, AlertTriangle, Users } from "lucide-react";

export interface PayoutMetrics {
  totalAccrued: number;
  pending: number;
  approved: number;
  paid: number;
  reversed: number;
  contributingLeads: number;
}

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

interface Props {
  metrics: PayoutMetrics;
  onFilterStatus: (status: string | null) => void;
  activeStatus: string | null;
}

export function PayoutSummaryCards({ metrics, onFilterStatus, activeStatus }: Props) {
  const cards = [
    { key: null, label: "Total Accrued", value: formatINR(metrics.totalAccrued), icon: DollarSign, color: "text-primary" },
    { key: "pending", label: "Pending", value: formatINR(metrics.pending), icon: Clock, color: "text-amber-600" },
    { key: "approved", label: "Approved", value: formatINR(metrics.approved), icon: CheckCircle, color: "text-blue-600" },
    { key: "paid", label: "Paid", value: formatINR(metrics.paid), icon: CreditCard, color: "text-emerald-600" },
    { key: "reversed", label: "Reversed", value: formatINR(metrics.reversed), icon: AlertTriangle, color: "text-destructive" },
    { key: "leads", label: "Contributing Leads", value: String(metrics.contributingLeads), icon: Users, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = c.key !== "leads" && activeStatus === c.key;
        return (
          <Card
            key={c.label}
            className={`h-full cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-primary" : ""} ${c.key === "leads" ? "cursor-default" : ""}`}
            onClick={() => {
              if (c.key === "leads") return;
              onFilterStatus(isActive ? null : c.key);
            }}
          >
            <CardContent className="p-4 text-center flex flex-col items-center justify-center gap-1 min-h-[96px]">
              <Icon className={`h-5 w-5 ${c.color}`} />
              <p className="text-lg font-bold leading-none truncate w-full" title={c.value}>{c.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{c.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
