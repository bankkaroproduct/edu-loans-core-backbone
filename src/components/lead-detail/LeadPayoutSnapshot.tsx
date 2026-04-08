import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { formatStageLabel } from "@/components/dashboard/StageBadge";
import type { Tables } from "@/integrations/supabase/types";

type PayoutRecord = Tables<"partner_payout_records">;

const PAYOUT_STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  triggered: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-green-50 text-green-800 border-green-200",
  reversed: "bg-destructive/10 text-destructive border-destructive/20",
  on_hold: "bg-yellow-50 text-yellow-700 border-yellow-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface Props {
  payouts: PayoutRecord[];
}

export function LeadPayoutSnapshot({ payouts }: Props) {
  if (payouts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Payout Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payouts.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <p className="text-sm font-medium">
                  {p.payout_amount ? `₹${Number(p.payout_amount).toLocaleString()}` : "Amount pending"}
                </p>
                {p.remarks && <p className="text-xs text-muted-foreground">{p.remarks}</p>}
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
