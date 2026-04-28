import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { isValidEmail, parseEmailList } from "@/lib/sendToLender/buildDraft";

interface Props {
  to: string;
  cc: string;
  onChange: (next: { to?: string; cc?: string }) => void;
  /** True when the lender row had no contact_email — show a soft hint */
  lenderEmailMissing: boolean;
}

export function LenderRecipientPicker({ to, cc, onChange, lenderEmailMissing }: Props) {
  const toInvalid = to.trim().length > 0 && !isValidEmail(to.trim());
  const ccInvalid = parseEmailList(cc).some((e) => !isValidEmail(e));

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="stl-to" className="text-xs">
          To <span className="text-destructive">*</span>
        </Label>
        <Input
          id="stl-to"
          type="email"
          value={to}
          onChange={(e) => onChange({ to: e.target.value })}
          placeholder="lender@example.com"
          aria-invalid={toInvalid}
        />
        {lenderEmailMissing && to.trim().length === 0 && (
          <div className="flex items-start gap-1.5 mt-1 text-[11px] text-amber-700 dark:text-amber-500">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Lender record has no contact email saved. Enter the recipient manually to enable Send.
            </span>
          </div>
        )}
        {toInvalid && (
          <p className="text-[11px] text-destructive mt-1">Enter a valid email address.</p>
        )}
      </div>

      <div>
        <Label htmlFor="stl-cc" className="text-xs">
          CC
        </Label>
        <Input
          id="stl-cc"
          value={cc}
          onChange={(e) => onChange({ cc: e.target.value })}
          placeholder="copy1@example.com, copy2@example.com"
        />
        {ccInvalid && (
          <p className="text-[11px] text-destructive mt-1">
            One or more CC addresses are invalid.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          Separate multiple addresses with commas.
        </p>
      </div>
    </div>
  );
}
