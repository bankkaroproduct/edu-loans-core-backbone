import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, TrendingUp, Clock, CheckCircle, AlertCircle,
  Upload, CreditCard, XCircle, Eye, Send, Ban, Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/formatCurrency";

export interface KPIData {
  totalLeads: number;
  leadsThisMonth: number;
  underReview: number;
  documentsPending: number;
  sentToLender: number;
  sanctionReceived: number;
  disbursed: number;
  rejectedDropped: number;
  bulkBatchesThisMonth: number;
  pendingPayout: number;
  paidPayout: number;
  needsAttention: number;
}

type Accent = "green" | "amber" | "red" | "blue" | "default";

interface KPIItem {
  key: keyof KPIData;
  label: string;
  icon: React.ElementType;
  format?: "currency";
  sub?: string;
  accent: Accent;
  emphasized?: boolean;
  dynamicSub?: (v: number) => string;
}

const accentBorder: Record<Accent, string> = {
  green: "border-l-4 border-l-emerald-500",
  amber: "border-l-4 border-l-amber-500",
  red: "border-l-4 border-l-destructive",
  blue: "border-l-4 border-l-primary",
  default: "",
};

const accentIconColor: Record<Accent, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-destructive",
  blue: "text-primary",
  default: "text-muted-foreground",
};

function formatValue(val: number, fmt?: "currency") {
  if (fmt === "currency") return formatINR(val);
  return val.toLocaleString("en-IN");
}

interface Cluster {
  heading: string;
  items: KPIItem[];
}

const clusters: Cluster[] = [
  {
    heading: "Lead Health",
    items: [
      { key: "totalLeads", label: "Total Leads", icon: FileText, sub: "All time", accent: "blue" },
      { key: "leadsThisMonth", label: "This Month", icon: TrendingUp, sub: "Submitted", accent: "blue" },
      { key: "underReview", label: "Under Review", icon: Eye, sub: "Active cases", accent: "amber" },
      { key: "sentToLender", label: "Sent to Lender", icon: Send, sub: "Login pending", accent: "blue" },
    ],
  },
  {
    heading: "Documents & Risk",
    items: [
      { key: "documentsPending", label: "Docs Pending", icon: AlertCircle, accent: "amber", emphasized: true, dynamicSub: (v) => v > 0 ? "Action needed" : "All clear" },
      { key: "needsAttention", label: "Needs Attention", icon: Ban, accent: "red", emphasized: true, dynamicSub: (v) => v > 0 ? "Action required" : "All clear" },
      { key: "rejectedDropped", label: "Rejected", icon: XCircle, sub: "Closed", accent: "red" },
      { key: "bulkBatchesThisMonth", label: "Bulk Batches", icon: Upload, sub: "This month", accent: "default" },
    ],
  },
  {
    heading: "Business Outcome",
    items: [
      { key: "sanctionReceived", label: "Sanctioned", icon: CheckCircle, sub: "Approved", accent: "green" },
      { key: "disbursed", label: "Disbursed", icon: Wallet, accent: "green", emphasized: true, dynamicSub: (v) => v > 0 ? "Great progress!" : "Pending" },
      { key: "pendingPayout", label: "Pending Payout", icon: Clock, format: "currency", sub: "Awaiting", accent: "amber" },
      { key: "paidPayout", label: "Payout Paid", icon: CreditCard, format: "currency", sub: "Received", accent: "green", emphasized: true },
    ],
  },
];

interface Props {
  data: KPIData;
  loading: boolean;
  onCardClick?: (key: string) => void;
}

export function KPICards({ data, loading, onCardClick }: Props) {
  return (
    <div className="space-y-2">
      {clusters.map((cluster) => (
        <div
          key={cluster.heading}
          className="bg-card/40 border border-border/40 rounded-lg px-4 py-3"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-1.5 mb-2">
            {cluster.heading}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cluster.items.map((kpi) => {
              const Icon = kpi.icon;
              const isEmphasized = kpi.emphasized;
              return (
                <Card
                  key={kpi.key}
                  className={`hover:shadow-md transition-shadow cursor-pointer ${accentBorder[kpi.accent]} ${isEmphasized ? "bg-primary/5" : ""}`}
                  onClick={() => onCardClick?.(kpi.key)}
                >
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {kpi.label}
                      </span>
                      <Icon className={`h-4 w-4 shrink-0 ${accentIconColor[kpi.accent]}`} />
                    </div>
                    {loading ? (
                      <Skeleton className="h-6 w-16" />
                    ) : (
                      <p className={`font-bold text-foreground leading-tight ${isEmphasized ? "text-xl" : "text-lg"}`}>
                        {formatValue(data[kpi.key], kpi.format)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">
                      {kpi.dynamicSub ? kpi.dynamicSub(data[kpi.key]) : kpi.sub}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
