import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertOctagon } from "lucide-react";
import type { BreResult } from "@/lib/bre/types";

export function RejectionPanel({ result }: { result: BreResult }) {
  if (result.rejection_reasons.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertOctagon className="h-4 w-4" />
      <AlertTitle>{result.eligibility_status === "Rejected" ? "Profile rejected" : "Issues detected"}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
          {result.rejection_reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
