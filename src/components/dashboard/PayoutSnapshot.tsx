import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Clock, CheckCircle, Wallet, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

export function PayoutSnapshot({ data, loading }: { data: PayoutSummary; loading: boolean }) {
  const navigate = useNavigate();
  const metrics = [
    { label: "Total Earned", value: data.totalAccrued, icon: Wallet, route: "/payouts" },
    { label: "Coming Soon", value: data.pending, icon: Clock, route: "/payouts?status=pending", accent: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "Approved", value: data.approved, icon: CheckCircle, route: "/payouts?status=approved" },
    { label: "Received", value: data.paid, icon: CreditCard, route: "/payouts?status=paid", accent: "bg-emerald-50 dark:bg-emerald-950/20" },
    ...(data.reversed > 0 ? [{ label: "Reversed", value: data.reversed, icon: AlertTriangle, route: "/payouts?status=reversed", accent: "" }] : []),
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Payout Summary</CardTitle>
        <Button variant="link" size="sm" onClick={() => navigate("/payouts")}>
          View Details →
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <div className={`grid grid-cols-2 ${metrics.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3 mb-4`}>
              {metrics.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.label}
                    className={`text-center p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${(m as any).accent ?? ""}`}
                    onClick={() => navigate(m.route)}
                  >
                    <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-bold">{formatINR(m.value)}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                );
              })}
            </div>
            {data.recentRecords.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Recent Records</p>
                {data.recentRecords.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-xs p-1.5 border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/payouts?lead=${r.leadId}`)}
                  >
                    <span className="font-mono text-muted-foreground">{r.leadId.slice(0, 8)}…</span>
                    <span className="font-medium">{r.amount ? formatINR(r.amount) : "—"}</span>
                    <span className="capitalize text-muted-foreground">{r.status.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
