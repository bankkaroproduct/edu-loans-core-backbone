import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ExternalLink } from "lucide-react";

export interface PayoutRecordRow {
  id: string;
  lead_id: string;
  lead_display_id: string | null;
  student_name: string | null;
  submitted_by: string | null;
  trigger_stage: string | null;
  payout_basis: string | null;
  payout_amount: number | null;
  payout_status: string;
  payout_triggered_at: string | null;
  payout_approved_at: string | null;
  payout_paid_at: string | null;
  remarks: string | null;
  updated_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  triggered: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reversed: "bg-destructive/10 text-destructive border-destructive/20",
  on_hold: "bg-yellow-50 text-yellow-700 border-yellow-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtINR = (n: number | null) => n != null ? `₹${n.toLocaleString("en-IN")}` : "—";

export type SortField = "updated_at" | "payout_amount" | "payout_status";
export type SortDir = "asc" | "desc";

interface Props {
  records: PayoutRecordRow[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

export function PayoutRecordsTable({ records, sortField, sortDir, onSort }: Props) {
  const navigate = useNavigate();

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead ID</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Submitted By</TableHead>
          <TableHead>Trigger Stage</TableHead>
          <TableHead>Basis</TableHead>
          <SortHeader field="payout_amount">Amount</SortHeader>
          <SortHeader field="payout_status">Status</SortHeader>
          <TableHead>Triggered</TableHead>
          <TableHead>Approved</TableHead>
          <TableHead>Paid</TableHead>
          <SortHeader field="updated_at">Updated</SortHeader>
          <TableHead>Remarks</TableHead>
          <TableHead className="w-[70px]">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => {
          const isReversed = r.payout_status === "reversed" || r.payout_status === "cancelled";
          return (
            <TableRow key={r.id} className={isReversed ? "bg-destructive/5" : ""}>
              <TableCell className="font-mono text-xs">{r.lead_display_id ?? r.lead_id.slice(0, 8)}</TableCell>
              <TableCell className="text-sm max-w-[140px] truncate">{r.student_name ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{r.submitted_by ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.trigger_stage ? fmt(r.trigger_stage) : "—"}</TableCell>
              <TableCell className="text-xs">{r.payout_basis ? fmt(r.payout_basis) : "—"}</TableCell>
              <TableCell className="font-medium">{fmtINR(r.payout_amount)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[r.payout_status] ?? ""}`}>
                  {fmt(r.payout_status)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{fmtDate(r.payout_triggered_at)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{fmtDate(r.payout_approved_at)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{fmtDate(r.payout_paid_at)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{fmtDate(r.updated_at)}</TableCell>
              <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{r.remarks ?? "—"}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate(`/leads/${r.lead_id}`)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
