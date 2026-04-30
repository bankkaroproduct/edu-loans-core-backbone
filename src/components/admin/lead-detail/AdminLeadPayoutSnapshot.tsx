// Admin-only payout snapshot. Visual mirror of LeadPayoutSnapshot.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatStageLabel } from "@/components/dashboard/StageBadge";
import type { Tables } from "@/integrations/supabase/types";

type PayoutRecord = Tables<"partner_payout_records">;

const PAYOUT_STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  triggered: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reversed: "bg-destructive/10 text-destructive border-destructive/20",
  on_hold: "bg-yellow-50 text-yellow-700 border-yellow-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface Props {
  payouts: PayoutRecord[];
  leadId: string;
}

export function AdminLeadPayoutSnapshot({ payouts, leadId }: Props) {
  const navigate = useNavigate();

  if (payouts.length === 0) return null;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null;

  return (
    <Card className="rounded-xl border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Wallet className="h-3.5 w-3.5 text-primary" />
          </span>
          Payout Status
        </CardTitle>
        {payouts.length > 1 && (
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0"
            onClick={() => navigate(`/payouts?lead=${leadId}`)}
          >
            View All ({payouts.length}) →
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-semibold tabular-nums">
                  {p.payout_amount ? `₹${Number(p.payout_amount).toLocaleString("en-IN")}` : "Amount pending"}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {p.payout_triggered_at && <span>Triggered {fmtDate(p.payout_triggered_at)}</span>}
                  {p.payout_paid_at && <span>• Paid {fmtDate(p.payout_paid_at)}</span>}
                </div>
                {p.remarks && <p className="text-xs text-muted-foreground truncate">{p.remarks}</p>}
              </div>
              <Badge variant="outline" className={`text-[10px] ${PAYOUT_STATUS_COLOR[p.payout_status] ?? ""}`}>
                {formatStageLabel(p.payout_status)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
