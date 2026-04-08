import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, TrendingUp, Clock, CheckCircle, AlertCircle,
  Upload, CreditCard, XCircle, Eye, Send, Ban, DollarSign,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

const kpiConfig: {
  key: keyof KPIData;
  label: string;
  icon: React.ElementType;
  format?: "currency";
  sub?: string;
}[] = [
  { key: "totalLeads", label: "Total Leads", icon: FileText, sub: "All time" },
  { key: "leadsThisMonth", label: "This Month", icon: TrendingUp, sub: "Submitted" },
  { key: "underReview", label: "Under Review", icon: Eye, sub: "Active cases" },
  { key: "documentsPending", label: "Docs Pending", icon: AlertCircle, sub: "Needs upload" },
  { key: "sentToLender", label: "Sent to Lender", icon: Send, sub: "Login pending" },
  { key: "sanctionReceived", label: "Sanctioned", icon: CheckCircle, sub: "Approved" },
  { key: "disbursed", label: "Disbursed", icon: DollarSign, sub: "Completed" },
  { key: "rejectedDropped", label: "Rejected / Dropped", icon: XCircle, sub: "Closed" },
  { key: "bulkBatchesThisMonth", label: "Bulk Batches", icon: Upload, sub: "This month" },
  { key: "pendingPayout", label: "Payout Pending", icon: Clock, format: "currency", sub: "Awaiting" },
  { key: "paidPayout", label: "Payout Paid", icon: CreditCard, format: "currency", sub: "Received" },
  { key: "needsAttention", label: "Needs Attention", icon: Ban, sub: "Action required" },
];

function formatValue(val: number, fmt?: "currency") {
  if (fmt === "currency") return `₹${val.toLocaleString("en-IN")}`;
  return val.toLocaleString("en-IN");
}

interface Props {
  data: KPIData;
  loading: boolean;
  onCardClick?: (key: string) => void;
}

export function KPICards({ data, loading, onCardClick }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card
            key={kpi.key}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onCardClick?.(kpi.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {kpi.label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl font-bold text-foreground">
                  {formatValue(data[kpi.key], kpi.format)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
